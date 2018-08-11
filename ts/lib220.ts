import { getRunner } from './runtime';

var ImageData: any = ImageData;

if (typeof ImageData === 'undefined') {
  ImageData = class {
    width: number = 1;
    height: number = 1;
    data: Uint8ClampedArray = new Uint8ClampedArray(4);
    constructor(width: number, height: number) {
      if (arguments.length !== 2) {
        throw new TypeError(`Failed to construct Node 'ImageData': 2 arguments required but ${arguments.length} given`);
      }
      if ((typeof width !== 'number' || width === 0)) {
        throw new Error('Failed to construct \'ImageData\': width is zero or not a number.');
      }
      if ((typeof height !== 'number' || height === 0)) {
        throw new Error('Failed to construct \'ImageData\': width is zero or not a number.');
      }
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(4 * this.width * this.height);
    }
  }
}

function assertValidPixel(pixel: any) {
  if (pixel.length !== 3) {
    throw new Error(`A pixel must be a 3-element array`);
  }
  for (let i = 0; i < 3; i++) {
    if (pixel[i] < 0.0 || pixel[i] > 1.0) {
      throw new Error(`Pixel not in range`);
    }
  }
}

function EncapsulatedImage(imageData: any) {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  function assertValidCoordinate(x: any, y: any) {
    if (x < 0 || y < 0 || x >= w || y >= h) {
      throw new Error(`Coordinate (${x}, ${y}) is not valid. The image has height
      ${h} and width ${w}.`);
    }
  }



  return Object.freeze({
    width: w,
    height: h,
    copy: function() {
      const copiedImage = EncapsulatedImage(new ImageData(w, h));
      let pixel;
      for (let i = 0; i < w; i++) {
        for (let j = 0; j < h; j++) {
          pixel = this.getPixel(i, j);
          copiedImage.setPixel(i, j, pixel);
        }
      }
      return copiedImage;
    },
    show: function () {
      if (typeof document === 'undefined') {
        return; //  for node
      }
      const canvases = document.getElementById('canvases')!;
      const canvas = document.createElement('canvas');
      canvas.setAttribute('width', w);
      canvas.setAttribute('height', h);
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(imageData, 0, 0);
      canvases.appendChild(canvas);
    },
    setPixel: function(x: any, y: any, c: any) {
      if (arguments.length !== 3) {
        throw new Error(`.setPixel expects 3 arguments, received ${arguments.length}`);
      }
      assertValidCoordinate(x, y);
      assertValidPixel(c);
      let index = 4 * (y * w + x);
      data[index] = Math.round(c[0] * 255);
      data[index + 1] = Math.round(c[1] * 255);
      data[index + 2] = Math.round(c[2] * 255);
      data[index + 3] = 255;
    },
    getPixel: function(x: any, y: any) {
      if (arguments.length !== 2) {
        throw new Error(`.getPixel expects 2 arguments, received ${arguments.length}`);
      }
      assertValidCoordinate(x, y);
      let index = 4 * (y * w + x);
      const p = [
        data[index] / 255.0,
        data[index + 1] / 255.0,
        data[index + 2] / 255.0
      ];
      return p;
    }
  });
}

export function loadImageFromURL(url: any) {
  if (typeof document === 'undefined') {
    return; // for node
  }
  const runnerResult = getRunner();
  if (runnerResult.kind === 'error') {
    throw new Error('Program is not running');
  }
  const runner = runnerResult.value;

  return runner.pauseImmediate(() => {
    const img = new Image();

    img.onerror = () => {
      runner.continueImmediate({
        type: 'exception',
        value: new Error(`Could not load ${url}`)
      });
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('height', String(img.height));
      canvas.setAttribute('width', String(img.width));
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      runner.continueImmediate({
        type: 'normal',
        value: EncapsulatedImage(imageData)
      });
    };

    img.setAttribute('crossOrigin', 'Anonymous');
    img.src = url;
  });
}

export function createImage(width: number, height: number, fill?: [number, number, number]) {
  let img = EncapsulatedImage(new ImageData(width, height));
  if (typeof fill !== 'undefined') {
    assertValidPixel(fill);
    let i, j;
    for (i = 0; i < width; i++) {
      for (j = 0; j < height; j++) {
        img.setPixel(i, j, fill)
      }
    }
  }
  
  return img;
}