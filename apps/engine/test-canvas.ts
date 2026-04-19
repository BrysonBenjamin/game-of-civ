/* 
There is a known issue combining pre-initialized WebGPURenderer (from three/webgpu)
and react-three-fiber's Canvas.
We will write a small document in the DOM to check resize logic. 
*/
import { WebGPURenderer } from 'three/webgpu';

async function verify() {
  try {
    const renderer = new WebGPURenderer({ antialias: true });
    await renderer.init();
    console.log("Renderer canvas size:", renderer.domElement.width, renderer.domElement.height);
    renderer.setSize(800, 600);
    console.log("After setSize:", renderer.domElement.width, renderer.domElement.height);
  } catch(e) {
    console.error(e);
  }
}
verify();
