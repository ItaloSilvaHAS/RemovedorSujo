from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from rembg import remove, new_session
from PIL import Image
import io
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)

# O modelo ISNET-GENERAL-USE é o topo de linha para objetos físicos
session = new_session("isnet-general-use")

def process_ml_format(input_data):
    input_image = Image.open(io.BytesIO(input_data))
    
    # --- MELHORIA NO RECORTE ---
    # alpha_matting: Refina as bordas para não ficar serrilhado
    # foreground_threshold: Aumentado para 270 (evita que a IA ache que o metal é fundo)
    # erode_size: Definido em 15 para "lixar" as bordas e tirar pixels soltos
    output_transparent = remove(
        input_image, 
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=270,
        alpha_matting_background_threshold=20,
        alpha_matting_erode_size=15
    )
    
    # 1. CROP TOTAL (Remove o vazio)
    bbox = output_transparent.getbbox()
    if bbox:
        output_transparent = output_transparent.crop(bbox)
    
    # 2. REDIMENSIONAMENTO MÁXIMO (1080x1080)
    target_size = (1080, 1080)
    width, height = output_transparent.size
    
    # Calculamos para ocupar 100% do espaço disponível
    ratio = min(target_size[0] / width, target_size[1] / height)
    new_size = (int(width * ratio), int(height * ratio))
    
    # Resampling.LANCZOS é essencial para não pixelar ao aumentar
    output_transparent = output_transparent.resize(new_size, Image.Resampling.LANCZOS)
    
    # 3. FUNDO BRANCO PURO
    canvas = Image.new("RGB", target_size, (255, 255, 255))
    
    # 4. CENTRALIZAÇÃO TOTAL
    offset = (
        (target_size[0] - output_transparent.width) // 2,
        (target_size[1] - output_transparent.height) // 2
    )
    
    # Colamos usando a própria imagem como máscara para manter a suavidade
    canvas.paste(output_transparent, offset, mask=output_transparent)
    
    # 5. SALVAMENTO PROFISSIONAL
    img_io = io.BytesIO()
    # quality=100 e subsampling=0 garantem que a compressão não estrague os detalhes
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
        
        logging.info("Imagem processada com refino de bordas e tamanho máximo.")
        return send_file(result_buffer, mimetype='image/jpeg')
    except Exception as e:
        logging.error(f"Erro: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # debug=False para o servidor ficar mais estável no Garuda
    app.run(host='0.0.0.0', port=5000, debug=False)