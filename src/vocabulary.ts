export const FRAME_TAGS = ['header', 'footer', 'section', 'article', 'aside'];
export const TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'dt', 'dd', 'blockquote', 'pre', 'table', 'label'];
export const MEDIA_TAGS = ['img', 'picture', 'svg', 'math', 'video', 'audio', 'canvas', 'iframe', 'object', 'embed'];
export const CONTROL_TAGS = ['button', 'input', 'select', 'textarea', 'progress', 'meter'];
export const BUTTONISH = '.button, .btn, [role="button"], [data-agent-build]';

/* A link that wraps any of these, the usual card, is a frame whose parts get
   built one by one. */
export const BLOCKS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figure', 'picture', 'img', 'video', 'table',
  'blockquote', 'pre'].join(', ');
