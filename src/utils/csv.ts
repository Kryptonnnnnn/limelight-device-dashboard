import { DeviceSample } from '../types/DeviceSample';

export function exportSamplesToCsv(samples: DeviceSample[]): void {
  if (!samples.length) return;

  const headers = Object.keys(samples[0]) as (keyof DeviceSample)[];
  const lines: string[] = [];

  lines.push(headers.join(','));

  samples.forEach((s) => {
    const row = headers
      .map((h) => {
        const val = s[h];
        return JSON.stringify(val ?? '');
      })
      .join(',');
    lines.push(row);
  });

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'visible-window.csv';
  a.click();
  URL.revokeObjectURL(url);
}