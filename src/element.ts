import { mount } from './mount.ts';

/* <agent-build-button label="…" data-agent-count="…"> works in any framework
   and in plain HTML: it renders its own hidden trigger, passes on its
   data-agent-* options and mounts it as soon as it is in the document,
   however late that is. */
export function defineElement(name = 'agent-build-button'): void {
  if (typeof customElements === 'undefined' || customElements.get(name)) {
    return;
  }
  customElements.define(name, class extends HTMLElement {
    connectedCallback() {
      if (!this.querySelector(':scope > [data-agent-build]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.hidden = true;
        button.setAttribute('data-agent-build', '');
        for (const { name: attribute, value } of [...this.attributes]) {
          if (attribute.startsWith('data-agent-')) {
            button.setAttribute(attribute, value);
          }
        }
        const label = this.getAttribute('label');
        if (label) {
          button.textContent = label;
        }
        this.append(button);
      }
      mount(this);
    }
  });
}
