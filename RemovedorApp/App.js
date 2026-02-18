import React, { useState } from 'react';
import { 
  Button, 
  Image, 
  View, 
  ActivityIndicator, 
  Alert, 
  StyleSheet, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StatusBar
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function App() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);

  // IP Fixo da sua máquina
  const SERVER_URL = 'http://192.168.0.6:5000/remove-bg';

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Erro", "Precisamos de permissão para acessar suas fotos.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 1,
    });

    if (!result.canceled) {
      processQueue(result.assets);
    }
  };

  const processQueue = async (assets) => {
    setLoading(true);
    setTotalToProcess(assets.length);
    setCurrentProcessing(0);
    setImages([]); 
    const processed = [];

    for (let i = 0; i < assets.length; i++) {
      setCurrentProcessing(i + 1);
      const asset = assets[i];
      try {
        const formData = new FormData();
        formData.append('image', { 
          uri: asset.uri, 
          name: `image_${i}.jpg`, 
          type: 'image/jpeg' 
        });

        const response = await fetch(SERVER_URL, { 
          method: 'POST', 
          body: formData 
        });

        if (response.status === 200) {
          const blob = await response.blob();
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result);
          });
          processed.push(base64);
          // Atualiza a lista conforme processa para feedback visual imediato
          setImages(prev => [...prev, base64]);
        } else {
          console.log("Erro no servidor ao processar uma imagem.");
        }
      } catch (e) {
        console.log("Erro de conexão:", e);
      }
    }

    setLoading(false);
    if (processed.length > 0) {
      Alert.alert("Sucesso!", `${processed.length} imagens processadas com qualidade máxima!`);
    }
  };

  const shareImage = async (imgBase64) => {
    try {
      const cacheDir = FileSystemLegacy.cacheDirectory;
      const filename = `${cacheDir}PRODUTO_ML_${Date.now()}.jpg`;
      const base64Data = imgBase64.split('base64,')[1];
      
      await FileSystemLegacy.writeAsStringAsync(filename, base64Data, {
        encoding: 'base64', 
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filename);
      }
    } catch (e) {
      console.log("Erro ao compartilhar:", e);
      Alert.alert("Erro", "Não foi possível compartilhar a imagem.");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>ML Photo Express</Text>
          <Text style={styles.subtitle}>IA de Remoção Profissional</Text>
        </View>
        
        <TouchableOpacity style={styles.mainButton} onPress={pickImages} disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? 'Processando...' : 'Selecionar até 10 Fotos'}
          </Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#3483fa" />
            <Text style={styles.loadingText}>
              Processando {currentProcessing} de {totalToProcess}
            </Text>
            <Text style={styles.subLoadingText}>Sua IA está refinando as bordas...</Text>
          </View>
        )}

        <View style={styles.grid}>
          {images.map((img, index) => (
            <View key={index} style={styles.card}>
              <View style={styles.imageContainer}>
                <Image source={{ uri: img }} style={styles.image} />
              </View>
              <TouchableOpacity style={styles.downloadBtn} onPress={() => shareImage(img)}>
                <Text style={styles.downloadBtnText}>Baixar / Compartilhar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {images.length > 0 && !loading && (
          <TouchableOpacity style={styles.clearButton} onPress={() => setImages([])}>
            <Text style={styles.clearButtonText}>Limpar Galeria</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    backgroundColor: '#F5F5F5', 
    alignItems: 'center', 
    paddingVertical: 40 
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: { 
    fontSize: 32, 
    fontWeight: '900', 
    color: '#333',
    letterSpacing: -1
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5
  },
  mainButton: { 
    backgroundColor: '#3483fa',
    width: '90%', 
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 20
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold'
  },
  loader: { 
    marginVertical: 10, 
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 20,
    width: '90%',
    borderWidth: 1,
    borderColor: '#EEE'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  subLoadingText: {
    color: '#999',
    marginTop: 5
  },
  grid: {
    width: '100%',
    alignItems: 'center'
  },
  card: { 
    backgroundColor: '#fff', 
    padding: 12, 
    borderRadius: 20, 
    marginBottom: 25, 
    alignItems: 'center', 
    width: '92%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  image: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'contain'
  },
  downloadBtn: {
    marginTop: 15,
    backgroundColor: '#00a650',
    width: '100%',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  downloadBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16
  },
  clearButton: {
    marginTop: 10,
    padding: 15,
    width: '90%',
    alignItems: 'center',
    marginBottom: 40
  },
  clearButtonText: {
    color: '#FF4444',
    fontWeight: 'bold',
    fontSize: 16
  }
});