from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from rembg import remove, new_session
from PIL import Image
import io
import logging
import os

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)

# --- CONFIGURAÇÃO DO MODELO LEVE ---
# Forçamos o uso do u2netp (p de portable) para rodar no plano gratuito
os.environ["U2NET_HOME"] = os.path.join(os.getcwd(), ".u2net")

try:
    logging.info("Carregando modelo ultra-leve U2NETP...")
    # O modelo u2netp consome pouquíssima RAM
    session = new_session("u2netp")
except Exception as e:
    logging.error(f"Erro ao carregar modelo: {e}")
    session = new_session("u2netp") # Tentativa de redundância

def process_ml_format(input_data):
    input_image = Image.open(io.BytesIO(input_data))
    
    # Recorte otimizado
    output_transparent = remove(
        input_image, 
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10
    )
    
    bbox = output_transparent.getbbox()
    if bbox:
        output_transparent = output_transparent.crop(bbox)
    
    target_size = (1080, 1080)
    padding_factor = 0.95 
    width, height = output_transparent.size
    
    ratio = min((target_size[0] * padding_factor) / width, (target_size[1] * padding_factor) / height)
    new_size = (int(width * ratio), int(height * ratio))
    
    output_transparent = output_transparent.resize(new_size, Image.Resampling.LANCZOS)
    
    canvas = Image.new("RGB", target_size, (255, 255, 255))
    offset = (
        (target_size[0] - output_transparent.width) // 2,
        (target_size[1] - output_transparent.height) // 2
    )
    
    canvas.paste(output_transparent, offset, mask=output_transparent)
    
    img_io = io.BytesIO()
    canvas.save(img_io, 'JPEG', quality=100, subsampling=0)
    img_io.seek(0)
    return img_io

@app.route('/remove-bg', methods=['POST'])
def remove_background():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image"}), 400
            
        file = request.files['image']
        result_buffer = process_ml_format(file.read())
        return send_file(result_buffer, mimetype='image/jpeg')
    except Exception as e:
        logging.error(f"Erro no processamento: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "online", "model": "u2netp"}), 200

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port, debug=False)