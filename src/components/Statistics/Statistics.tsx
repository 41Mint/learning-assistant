import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStudyLogStore } from '../../store/studyLogStore';
import { formatDate } from '../../utils/storage';

interface DayData {
  date: string;
  minutes: number;
}

function createDayData(days: number, durationByDate: Map<string, number>): DayData[] {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    const key = formatDate(date);
    return { date: key, minutes: durationByDate.get(key) ?? 0 };
  });
}

function shortDate(value: string) {
  return Number(value.slice(5, 7)) + '/' + Number(value.slice(8, 10));
}

function StudyTrend({ data }: { data: DayData[] }) {
  const title = `近 ${data.length} 天学习曲线`;
  const studyDays = data.filter(({ minutes }) => minutes > 0);
  const average = studyDays.length ? Math.round(studyDays.reduce((sum, day) => sum + day.minutes, 0) / studyDays.length) : 0;
  const labels = [0, 1, 2, 3].map((step) => data[Math.round((data.length - 1) * step / 3)].date);

  return <section className="study-trend" aria-label={title}>
    <header className="history-card-heading">
      <h3>{title}</h3>
      <span>学习日均 {average} 分钟</span>
    </header>
    <ResponsiveContainer width="100%" height={144}>
      <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} syncWithTicks stroke="var(--app-border)" strokeDasharray="3 3" />
        <XAxis dataKey="date" ticks={labels} tickFormatter={shortDate} tick={{ fill: 'var(--app-muted)', fontSize: 11 }}
          tickLine={false} axisLine={false} minTickGap={8} padding={{ left: 5, right: 4 }} />
        <YAxis width={36} domain={[0, (max: number) => Math.max(25, max)]} allowDecimals={false}
          tickCount={4} tick={{ fill: 'var(--app-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip formatter={(minutes) => [minutes + ' 分钟', '学习时长']}
          contentStyle={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', borderRadius: 8, color: 'var(--app-text)' }}
          labelStyle={{ color: 'var(--app-muted)' }} itemStyle={{ color: 'var(--app-text)' }} />
        <Line dataKey="minutes" type="linear" stroke="var(--app-accent)" strokeWidth={2} dot={data.length === 7 ? { r: 2 } : false}
          activeDot={{ r: 4 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </section>;
}

export default function Statistics() {
  const logs = useStudyLogStore((state) => state.logs);
  const month = useMemo(() => createDayData(30, new Map(logs.map(({ date, duration }) => [date, duration]))), [logs]);
  const today = month[month.length - 1];

  return <section className="module-card stats-card" aria-label="学习统计">
    <div className="history-card-heading">
      <h2>学习统计</h2>
      <span>图中时长以分钟计</span>
    </div>
    <div className="study-today-total">
      <span>今日学习时长</span>
      <strong>{today.minutes} <small>分钟</small></strong>
    </div>
    <StudyTrend data={month.slice(-7)} />
    <StudyTrend data={month} />
  </section>;
}
