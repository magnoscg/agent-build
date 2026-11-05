const SVG_NS = 'http://www.w3.org/2000/svg';

export const FADE_IN: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
export const FADE_OUT: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

export function el<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  className = '',
  text?: string,
): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

export function svg(className: string, viewBox: string, shapes: [string, Record<string, string>][]): SVGSVGElement {
  const icon = document.createElementNS(SVG_NS, 'svg');
  icon.setAttribute('class', className);
  icon.setAttribute('viewBox', viewBox);
  for (const [tag, attributes] of shapes) {
    const shape = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) {
      shape.setAttribute(name, value);
    }
    icon.append(shape);
  }
  return icon;
}

export function makeDots(extra?: string): HTMLSpanElement {
  const dots = el('span', extra ? `agent-build-dots ${extra}` : 'agent-build-dots');
  dots.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 5; index += 1) {
    dots.append(el('i'));
  }
  return dots;
}
