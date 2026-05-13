declare const __VERSION__: string;
declare const __BUILD_DATE__: string;

declare module '*?raw' {
  const content: string;
  export default content;
}
