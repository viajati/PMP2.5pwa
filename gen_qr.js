const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const url = 'exp://192.168.137.1:8081';
const artifactsDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\36807419-8e19-4785-a391-723d95d1925d\\artifacts';
if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
}
QRCode.toFile(path.join(artifactsDir, 'expo_qr.png'), url, {
  width: 400,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
}, function (err) {
  if (err) throw err;
  console.log('QR DONE');
});
