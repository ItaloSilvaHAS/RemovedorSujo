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

# O modelo ISNET-GENERAL-USE é o topo de linha para objetos físicos
try:
    session = new_session("isnet-general-use")
except Exception as e:
    logging.warning(f"Não foi possível carregar o modelo isnet: {e}. Usando modelo padrão.")
    session = new_session("u2net")

def process_ml_format(input_data):
    input_image = Image.open(io.BytesIO(input_data))
    
    # --- MELHORIA NO RECORTE ---
    # alpha_matting: Refina as bordas para não ficar serrilhado
    # foreground_threshold: Ajustado para 240 para ser mais permissivo com detalhes metálicos
    # background_threshold: Reduzido para 10 para limpar rebarbas mais sutis
    # erode_size: Reduzido para 10 para evitar comer demais o objeto, mas limpando a borda
    output_transparent = remove(
        input_image, 
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10
    )
    
    # 1. CROP TOTAL (Remove o vazio)
    bbox = output_transparent.getbbox()
    if bbox:
        output_transparent = output_transparent.crop(bbox)
    
    # 2. REDIMENSIONAMENTO MÁXIMO (1080x1080)
    # Aumentamos a escala para o objeto ocupar 95% do canvas (quase borda a borda)
    target_size = (1080, 1080)
    padding_factor = 0.95 
    width, height = output_transparent.size
    
    ratio = min((target_size[0] * padding_factor) / width, (target_size[1] * padding_factor) / height)
    new_size = (int(width * ratio), int(height * ratio))
    
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

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "online", "model": "isnet-general-use"}), 200

if __name__ == '__main__':
    # O Render injeta a porta necessária através da variável de ambiente PORT
    # Se não encontrar (rodando local), ele usa a 5000 por padrão
    port = int(os.environ.get("PORT", 5000))
    
    # Em produção (Render), o ideal é usar gunicorn, 
    # mas deixamos o app.run aqui para você continuar testando localmente
    app.run(host='0.0.0.0', port=port, debug=False)
