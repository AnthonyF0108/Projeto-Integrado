const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  env: () => process.env.NODE_ENV || 'production'
});
