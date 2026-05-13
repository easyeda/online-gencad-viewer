export function setupFilePicker(
  openBtn: HTMLElement,
  canvasContainer: HTMLElement,
  onLoad: (text: string, fileName: string) => void,
  welcomeOverlay?: HTMLElement
) {
  // Hidden file input
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.cad';
  input.style.display = 'none';
  document.body.appendChild(input);

  openBtn.addEventListener('click', () => input.click());
  if (welcomeOverlay) {
    welcomeOverlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-welcome-dropzone]')) {
        input.click();
      }
    });
  }
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    readFile(file, onLoad);
    input.value = '';
  });

  // Prevent browser from opening dropped files as new tabs
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  // Drag and drop on canvas
  let dragCounter = 0;

  canvasContainer.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    canvasContainer.style.outline = '2px dashed #4a9eff';
    canvasContainer.style.outlineOffset = '-4px';
  });

  canvasContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  canvasContainer.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      canvasContainer.style.outline = '';
    }
  });

  canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    canvasContainer.style.outline = '';
    const file = e.dataTransfer?.files[0];
    if (file) readFile(file, onLoad);
  });
}

function readFile(file: File, onLoad: (text: string, fileName: string) => void) {
  const reader = new FileReader();
  reader.onload = () => onLoad(reader.result as string, file.name);
  reader.readAsText(file);
}
