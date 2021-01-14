import { Injectable } from '@angular/core';

// import capacitor dependencies for camera functionality
import { Plugins, CameraResultType, Capacitor, FilesystemDirectory, CameraPhoto, CameraSource } from '@capacitor/core';

// get references to plugins related to camera functionality
const { Camera, Filesystem, Storage } = Plugins;

// for mobile support
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  public photos: Photo[] = [];
  private PHOTO_STORAGE: string = "photos";
  private platform: Platform;

  convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader;
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result)
    };
    // convert photo blob to base64
    reader.readAsDataURL(blob);
  });

  constructor(platform: Platform) {
    this.platform = platform;
   }

  public async addNewPhotoToGallery(){
    // take a photo
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });

    // save the picture and add it to the photo collection
    const savedImageFile = await this.saveCapturedPhoto(capturedPhoto);
    this.photos.unshift(savedImageFile);

    // assign a pointer to the recently captured photo so
    // it can be loaded at a later time
    Storage.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    });
  }

  // convenience method
  private async readAsBase64(cameraPhoto: CameraPhoto){
    // "hybrid" will detect cordova or capacitor
    if(this.platform.is("hybrid")){
      // read the file into base64 format
      const file = await Filesystem.readFile({
        path: cameraPhoto.path
      })

      return file.data;
    } else{
      // fetch the photo, read as a blob, then convert to base64 format
      const response = await fetch(cameraPhoto.webPath);
      const blob = await response.blob();

      return await this.convertBlobToBase64(blob) as string;
    }
  }

  private async saveCapturedPhoto(cameraPhoto : CameraPhoto) {
    // convert the photo to base64 because the FileSystem API requires it
    const cameraPhotoBase64 = await this.readAsBase64(cameraPhoto);

    // write the file to the data directory
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: cameraPhotoBase64,
      directory: FilesystemDirectory.Data
    });

    // hybrid is Cordova or Capacitor
    if(this.platform.is("hybrid")){
      // display the new image by rewriting the 'file://' path to HTTP
      // Details: https://ionicframework.com/docs/building/webview#file-protocol
      return{
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri)
      };
    } else{
      // use webPath to display the new image instead of base64 since
      // the photo is already loaded into memory
      return {
        filepath: fileName,
        webviewPath: cameraPhoto.webPath
      };
    }
  }

  public async loadSavedPhoto(){
    // retrieve cached photo array data
    const photoList = await Storage.get({key: this.PHOTO_STORAGE});
    this.photos = JSON.parse(photoList.value) || [];

    // only need to do this if running on the web
    if(!this.platform.is("hybrid")){
      // display the photo by reading the base64 format
      for(let photo of this.photos){
        // read each saved photo's data from the Filesystem
        const savedPhoto = await Filesystem.readFile({
          path: photo.filepath,
          directory: FilesystemDirectory.Data
        });

        // Web platform only: load the photo as base64 data
        photo.webviewPath = `data:image/jpeg;base64,${savedPhoto.data}`;
      }
    }
  }
}

// class to hold photo metadata
export interface Photo{
  filepath: string;
  webviewPath: string;
}
