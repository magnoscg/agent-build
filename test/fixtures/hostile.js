/* A component whose shadow root is closed: the library cannot look inside. */
customElements.define('closed-widget', class extends HTMLElement {
  constructor() {
    super();
    const label = document.createElement('p');
    label.textContent = 'Inside a closed shadow root';
    this.attachShadow({ mode: 'closed' }).append(label);
  }
});
