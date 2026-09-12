const percentile = (values, p) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * p))] : 0;

// Opt-in and entirely local. Frame intervals and CPU submission cost are not
// measurements of GPU time or end-to-end input latency.
export function installFeelLab({ game, reset }) {
  if (!new URLSearchParams(location.search).has('feel')) return null;
  const panel = document.createElement('details'); panel.className = 'feel-lab';
  const summary = document.createElement('summary'); summary.textContent = 'Padel feel lab'; panel.append(summary);
  const label = document.createElement('label'); label.textContent = 'Compare movement ';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Movement comparison');
  for (const [value, text] of [['responsive', 'Responsive + interpolation'], ['classic', 'Original movement + raw steps']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
  }
  label.append(select); panel.append(label);
  const note = document.createElement('p');
  note.textContent = 'Use the same rally seed and input. Other improvements stay enabled. This compares movement and rendering, not the complete old game.';
  panel.append(note);
  const output = document.createElement('pre'); panel.append(output);
  const button = document.createElement('button'); button.textContent = 'Restart identical practice'; panel.append(button);
  document.body.append(panel);
  const samples = new Array(18000); let count = 0, cursor = 0, updated = 0, dropped = 0;
  function restart() {
    count = cursor = dropped = 0; samples.fill(undefined);
    reset(select.value); output.textContent = 'Collecting active gameplay frames…';
  }
  select.addEventListener('change', restart); button.addEventListener('click', restart);
  return {
    get profile() { return select.value; },
    record({ interval, simulation, render, discarded, draws, triangles }, now) {
      if (game().stage === 'over') return;
      samples[cursor] = { interval: interval * 1000, simulation, render };
      cursor = (cursor + 1) % samples.length; count = Math.min(count + 1, samples.length); dropped += discarded;
      if (now - updated < 500) return; updated = now;
      const rows = samples.filter(Boolean), sorted = rows.map(row => row.interval).sort((a, b) => a - b);
      const mean = key => rows.reduce((sum, row) => sum + row[key], 0) / count;
      output.textContent = `${count} active frames (up to 18,000 retained)\nFrame p95 ${percentile(sorted, .95).toFixed(1)} ms · p99 ${percentile(sorted, .99).toFixed(1)} ms\nFrames >50 ms: ${sorted.filter(value => value > 50).length}\nCPU simulation ${mean('simulation').toFixed(2)} ms · draw submission ${mean('render').toFixed(2)} ms\nDraw calls ${draws} · triangles ${triangles}\nDropped catch-up time ${dropped.toFixed(3)} s\nNot a GPU or input-latency measurement.`;
    },
  };
}
