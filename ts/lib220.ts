import { getRunner, stopifyArray } from './runtime';

function hexColorChannel(n: number): string {
  let v = (Math.floor(n * 255)).toString(16);
  if (v.length < 2) v = '0' + v;
  return v;
}

function rgbToHex(rgb: number[]): string {
  let hex = '#';
  for (let i = 0; i < 3; ++i) {
    hex += hexColorChannel(rgb[i]);
  }
  return hex;
}

export class DrawingCanvas {
  width: number = 1;
  height: number = 1;
  ctx: CanvasRenderingContext2D | undefined = undefined;
  constructor(w: number, h: number) {
    if (arguments.length !== 2) {
      throw new TypeError(`Failed to construct Node 'DrawingCanvas': 2 arguments required but ${arguments.length} given`);
    }
    this.width = w;
    this.height = h;
    if (typeof document === 'undefined') {
      return;  // for node
    }
    const canvases = document.getElementById('canvases')!;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('width', this.width.toString());
    canvas.setAttribute('height', this.height.toString());
    this.ctx = canvas.getContext('2d')!;
    canvases.appendChild(canvas);
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
  drawLine(x1: number, y1: number, x2: number, y2: number, col: number[]) {
    if (this.ctx === undefined) {
      return;  // for node
    }
    if (col.length !== 3 ||
        typeof(col[0]) !== 'number' ||
        typeof(col[1]) !== 'number' ||
        typeof(col[2]) !== 'number') {
        throw new Error(`Invalid color value`);
    }
    this.ctx.strokeStyle = rgbToHex(col);
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }
  drawArc(x: number, y: number, r: number, a0: number, a1: number, col: number[]) {
    if (this.ctx === undefined) {
      return;  // for node
    }
    this.ctx.strokeStyle = rgbToHex(col);
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, a0, a1);
    this.ctx.stroke();
  }
  drawCircle(x: number, y: number, r: number, col: number[]) {
    this.drawArc(x, y, r, 0, 2 * Math.PI, col);
  }
  clear() {
    if (this.ctx === undefined) {
      return;  // for node
    }
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
}

export function newCanvas(w: number, h: number) {
  return new DrawingCanvas(w, h);
}

class FudgedImageData implements ImageData {
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

function createImageData(w: number, h: number): ImageData {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(w, h);
  }
  else {
    return new FudgedImageData(w, h);
  }
}

function assertValidPixel(pixel: any) {
  if (pixel.length !== 3) {
    throw new Error(`A pixel value must be a 3-element array`);
  }
  for (let i = 0; i < 3; i++) {
    if (pixel[i] < 0.0 || pixel[i] > 1.0) {
      throw new Error(`Pixel channel value ${pixel[i]} is invalid`);
    }
  }
}

function EncapsulatedImage(imageData: any) {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  function assertValidCoordinate(x: any, y: any) {
    if (x < 0 || y < 0 || x >= w || y >= h) {
      throw new Error(`Pixel coordinate (${x}, ${y}) is invalid. The image has height ${h} and width ${w}.`);
    }
  }

  return Object.freeze({
    width: w,
    height: h,
    copy: function() {
      const copiedImage = EncapsulatedImage(createImageData(w, h));
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
      canvases.appendChild(document.createElement('br'));
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
      const p = stopifyArray([
        data[index] / 255.0,
        data[index + 1] / 255.0,
        data[index + 2] / 255.0
      ]);
      return p;
    }
  });
}

export function loadImageFromURL(url: any) {
  if (typeof document === 'undefined') {
    return EncapsulatedImage(createImageData(50, 50));
    // TODO (Sam): student can get a pixel that is out of bound.
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
        stack: [],
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
    const userEmail = localStorage.getItem('userEmail');
    const sessionId = localStorage.getItem('sessionId');
    if (userEmail === null || sessionId === null) {
      runner.continueImmediate({
        type: 'exception',
        stack: [],
        value: new Error(`User is not logged in`)
      });
    }
    const encodedURL = encodeURIComponent(url);
    const getUrlLink = ` https://us-central1-arjunguha-research-group.cloudfunctions.net/paws/geturl?`
    const queryURL = `${getUrlLink}url=${encodedURL}&user=${userEmail}&session=${sessionId}`;
    console.log(queryURL);
    fetch(queryURL).then(response => {
      if (response.status !== 200) {
        runner.continueImmediate({
          type: 'exception',
          stack: [],
          value: new Error(`Could not load image, URL may be invalid or redirected`),
        });
      }
      return response.blob();
    }).then(blob => {
      let objectURL = URL.createObjectURL(blob);
      img.src = objectURL;
    }).catch(err => {
      runner.continueImmediate({
        type: 'exception',
        stack: [],
        value: new Error(`Could not load image`),
      });
    });
  });
}

export function createImage(width: number, height: number, fill: [number, number, number]) {
  if (arguments.length !== 3) {
    throw new Error(`createImage expects 3 arguments, received ${arguments.length}`);
  }
  let img = EncapsulatedImage(createImageData(width, height));
  assertValidPixel(fill);
  let i, j;
  for (i = 0; i < width; i++) {
    for (j = 0; j < height; j++) {
      img.setPixel(i, j, fill)
    }
  }

  return img;
}

export function makeArray(n: number, value: any) {
  let arr = [];
  for (let i = 0; i < n; ++i) {
    arr.push(value);
  }
  return stopifyArray(arr);
}
