import {decodePO33Backup} from './decoder/browser/src/codec/po33Codec.js?v=flowers-20261120-ui40';
self.onmessage=event=>{
  try {self.postMessage({project:decodePO33Backup(event.data)});}
  catch(error){self.postMessage({error:error.message});}
};
