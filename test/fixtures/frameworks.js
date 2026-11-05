/* Stand-ins for what frameworks do once the page has loaded: render a trigger
   whose click handler sits on the app root and starts a run with its own
   options, render a hidden trigger and mount it later, and insert the
   custom element. */
addEventListener('load', () => {
  const root = document.getElementById('root');

  const framework = document.createElement('button');
  framework.id = 'framework';
  framework.setAttribute('data-agent-build', '');
  framework.textContent = 'Framework button';
  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('#framework');
    if (trigger) {
      window.AgentBuild.start({ trigger, count: 3 });
    }
  });

  const late = document.createElement('button');
  late.id = 'late';
  late.hidden = true;
  late.setAttribute('data-agent-build', '');

  const element = document.createElement('agent-build-button');
  element.id = 'element';
  element.setAttribute('label', 'Build with five');
  element.setAttribute('data-agent-count', '5');

  root.append(framework, late, element);
});
