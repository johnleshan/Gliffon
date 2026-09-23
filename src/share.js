export function glyphCard(g) {
  const lines = [`${g.symbol}  ${g.label}`];
  if (g.note) lines.push(g.note);
  lines.push('— shared from Gliffon ◆');
  return lines.join('\n');
}

export const remind = {
  async enable() {
    if (!('Notification' in window)) return 'unsupported';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    localStorage.setItem('glifon.remind', 'on');
    new Notification('Glifon', { body: 'Daily glyph reminder is on. See you here ✦' });
    return 'on';
  },
  disable() {
    localStorage.setItem('glifon.remind', 'off');
  },
  status() {
    if (!('Notification' in window)) return 'unsupported';
    return localStorage.getItem('glifon.remind') || 'off';
  },
  schedule(hour = 20) {
    if (this.status() !== 'on' || Notification.permission !== 'granted') return;
    const now = new Date();
    const next = new Date();
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    setTimeout(() => {
      if (document.visibilityState !== 'hidden') return;
      new Notification('Glifon', { body: 'Time to cast your daily glyph ✦', tag: 'glifon-daily' });
      this.schedule(hour);
    }, next - now);
  }
};
