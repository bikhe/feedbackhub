import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Button, Select, Space, Table, Tag, Avatar,
  DatePicker, Empty, Divider, Statistic, Progress, Tabs, Badge, Tooltip, message,
} from 'antd';
import {
  FileExcelOutlined, FilterOutlined, ReloadOutlined, UserOutlined,
  SmileOutlined, FrownOutlined, CalendarOutlined, TeamOutlined,
} from '@ant-design/icons';
import { analyticsApi, downloadBlob } from '../api/analytics';
import { feedbackApi } from '../api/feedback';
import { usersApi } from '../api/users';
import { FeedbackListItem, UserShort, UserAnalytics, LeaderboardEntry } from '../types';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type ReportTab = 'feedback' | 'users' | 'leaderboard';

interface FiltersState {
  dateRange: [Dayjs, Dayjs] | null;
  sentiment: string | null;
  authorId: string | null;
  recipientId: string | null;
  period: string;
}

const defaultFilters: FiltersState = { dateRange: null, sentiment: null, authorId: null, recipientId: null, period: 'month' };

const getSentimentLabel = (s: string | null) => { if (s === 'positive') return 'Позитивный'; if (s === 'negative') return 'Негативный'; return 'Нейтральный'; };

const FeedbackTable: React.FC<{ data: FeedbackListItem[]; loading: boolean; total: number; page: number; onPageChange: (p: number) => void }> = ({ data, loading, total, page, onPageChange }) => {
  const columns = [
    { title: 'Дата', dataIndex: 'created_at', key: 'created_at', width: 110, render: (val: string) => <Tooltip title={dayjs(val).format('DD.MM.YYYY HH:mm')}><Text style={{ fontSize: 12 }}>{dayjs(val).format('DD MMM YYYY')}</Text></Tooltip> },
    { title: 'От кого', key: 'author', width: 160, render: (_: any, r: FeedbackListItem) => { const a = r.author; const isAnon = !a?.id; return <Space size={8}><Avatar size={28} style={{ backgroundColor: isAnon ? '#808080' : (a as any)?.avatar_color || '#1890ff', flexShrink: 0 }}>{isAnon ? '?' : a?.initials}</Avatar><Text style={{ fontSize: 12 }}>{isAnon ? 'Аноним' : a?.short_name}</Text></Space>; } },
    { title: 'Кому', key: 'recipient', width: 160, render: (_: any, r: FeedbackListItem) => <Space size={8}><Avatar size={28} style={{ backgroundColor: r.recipient.avatar_color, flexShrink: 0 }}>{r.recipient.initials}</Avatar><Text style={{ fontSize: 12 }}>{r.recipient.short_name}</Text></Space> },
    { title: 'Задача', key: 'task', width: 140, render: (_: any, r: FeedbackListItem) => <Tooltip title={r.task?.title}><Tag color="blue">{r.task?.code}</Tag></Tooltip> },
    { title: 'Теги', key: 'tags', render: (_: any, r: FeedbackListItem) => <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>{r.tags.map((t) => <Tooltip key={t.id} title={t.name}><span style={{ background: t.color + '20', border: `1px solid ${t.color}50`, color: t.color, borderRadius: 4, padding: '1px 6px', fontSize: 11, whiteSpace: 'nowrap' as const }}>{t.icon} {t.name}</span></Tooltip>)}</div> },
    { title: 'Тональность', key: 'sentiment', width: 130, render: (_: any, r: FeedbackListItem) => <Tag color={r.sentiment === 'positive' ? 'success' : 'error'} icon={r.sentiment === 'positive' ? <SmileOutlined /> : <FrownOutlined />}>{getSentimentLabel(r.sentiment)}</Tag> },
    { title: 'Комментарий', dataIndex: 'comment', key: 'comment', render: (val: string) => <Tooltip title={val}><Text ellipsis style={{ fontSize: 12, maxWidth: 200, display: 'block' }}>{val}</Text></Tooltip> },
  ];
  return <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" scroll={{ x: 900 }} pagination={{ current: page, total, pageSize: 20, onChange: onPageChange, showTotal: (t) => `Всего ${t} отзывов`, showSizeChanger: false }} />;
};

const UsersReportTable: React.FC<{ data: UserAnalytics[]; loading: boolean }> = ({ data, loading }) => {
  const columns = [
    { title: '№', key: 'index', width: 50, render: (_: any, __: any, idx: number) => <Text type="secondary">{idx + 1}</Text> },
    { title: 'Сотрудник', key: 'user', render: (_: any, r: UserAnalytics) => <Space size={10}><Avatar style={{ backgroundColor: r.user.avatar_color }} size={38}>{r.user.initials}</Avatar><div><Text strong style={{ fontSize: 13 }}>{r.user.full_name}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.user.position || r.user.department || '—'}</Text></div></Space> },
    { title: 'Получено', dataIndex: 'received', key: 'received', sorter: (a: UserAnalytics, b: UserAnalytics) => a.received - b.received, render: (v: number) => <Text strong style={{ fontSize: 15 }}>{v}</Text> },
    { title: 'Позитивных', dataIndex: 'positive_received', key: 'pr', sorter: (a: UserAnalytics, b: UserAnalytics) => a.positive_received - b.positive_received, render: (v: number) => <Tag color="success" style={{ fontSize: 13 }}>+{v}</Tag> },
    { title: 'Негативных', dataIndex: 'negative_received', key: 'nr', sorter: (a: UserAnalytics, b: UserAnalytics) => a.negative_received - b.negative_received, render: (v: number) => <Tag color="error" style={{ fontSize: 13 }}>-{v}</Tag> },
    { title: 'Отдано', dataIndex: 'given', key: 'given', sorter: (a: UserAnalytics, b: UserAnalytics) => a.given - b.given },
    { title: 'Позитивность', key: 'positive_rate', sorter: (a: UserAnalytics, b: UserAnalytics) => a.positive_rate - b.positive_rate, render: (_: any, r: UserAnalytics) => <div style={{ minWidth: 140 }}><Text strong style={{ fontSize: 13, color: r.positive_rate >= 70 ? '#52c41a' : r.positive_rate >= 50 ? '#faad14' : '#ff4d4f' }}>{r.positive_rate}%</Text><Progress percent={r.positive_rate} showInfo={false} size="small" strokeColor={r.positive_rate >= 70 ? '#52c41a' : r.positive_rate >= 50 ? '#faad14' : '#ff4d4f'} /></div> },
  ];
  return <Table dataSource={data} columns={columns} rowKey={(r) => r.user.id} loading={loading} size="middle" scroll={{ x: 800 }} pagination={{ pageSize: 15, showSizeChanger: false }} />;
};

const LeaderboardTable: React.FC<{ data: LeaderboardEntry[]; loading: boolean }> = ({ data, loading }) => {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const columns = [
    { title: 'Место', dataIndex: 'rank', key: 'rank', width: 70, render: (r: number) => <div style={{ textAlign: 'center', fontSize: r <= 3 ? 22 : 14, fontWeight: 700 }}>{medals[r] || `#${r}`}</div> },
    { title: 'Сотрудник', key: 'user', render: (_: any, r: LeaderboardEntry) => <Space><Avatar style={{ backgroundColor: r.user.avatar_color }} size={40}>{r.user.initials}</Avatar><div><Text strong>{r.user.full_name}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.user.position || '—'}</Text></div></Space> },
    { title: 'Всего', dataIndex: 'total_received', key: 'tr', sorter: (a: LeaderboardEntry, b: LeaderboardEntry) => a.total_received - b.total_received, render: (v: number) => <Text strong style={{ fontSize: 16 }}>{v}</Text> },
    { title: 'Позитивных', dataIndex: 'positive_received', key: 'pr', render: (v: number) => <Tag color="success" style={{ fontSize: 14 }}>+{v}</Tag> },
    { title: 'Негативных', dataIndex: 'negative_received', key: 'nr', render: (v: number) => <Tag color={v > 0 ? 'error' : 'default'} style={{ fontSize: 14 }}>-{v}</Tag> },
    { title: 'Позитивность', key: 'positive_rate', sorter: (a: LeaderboardEntry, b: LeaderboardEntry) => a.positive_rate - b.positive_rate, render: (_: any, r: LeaderboardEntry) => <div style={{ minWidth: 160 }}><Text strong style={{ color: r.positive_rate >= 70 ? '#52c41a' : r.positive_rate >= 50 ? '#faad14' : '#ff4d4f' }}>{r.positive_rate}%</Text><Progress percent={r.positive_rate} showInfo={false} strokeColor={r.positive_rate >= 70 ? '#52c41a' : r.positive_rate >= 50 ? '#faad14' : '#ff4d4f'} size="small" /></div> },
  ];
  return <Table dataSource={data} columns={columns} rowKey={(r) => r.user.id} loading={loading} pagination={false} scroll={{ x: 700 }} />;
};

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('feedback');
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackListItem[]>([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [colleagues, setColleagues] = useState<UserShort[]>([]);

  useEffect(() => { usersApi.list({ is_active: true }).then((res) => setColleagues(res.results)).catch(console.error); }, []);

  const getParams = useCallback(() => {
    const params: Record<string, any> = {};
    if (filters.dateRange) { params.date_from = filters.dateRange[0].format('YYYY-MM-DD'); params.date_to = filters.dateRange[1].format('YYYY-MM-DD'); } else { params.period = filters.period; }
    if (filters.sentiment) params.sentiment = filters.sentiment;
    if (filters.authorId) params.author = filters.authorId;
    if (filters.recipientId) params.recipient = filters.recipientId;
    return params;
  }, [filters]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = getParams();
      if (activeTab === 'feedback') { const res = await feedbackApi.list({ ...params, page: feedbackPage }); setFeedbackList(res.results); setFeedbackTotal(res.count); }
      else if (activeTab === 'users') { const res = await analyticsApi.byUser(params); setUserAnalytics(res); }
      else if (activeTab === 'leaderboard') { const res = await analyticsApi.leaderboard({ ...params, limit: 50 }); setLeaderboard(res); }
    } catch (err) { console.error('Reports load error:', err); } finally { setIsLoading(false); }
  }, [activeTab, feedbackPage, getParams]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = async () => {
    setIsExporting(true);
    try { const blob = await analyticsApi.export({ ...getParams(), format: 'xlsx' }); downloadBlob(blob, `feedbackhub_report_${dayjs().format('YYYY-MM-DD')}.xlsx`); message.success('Отчёт скачан'); }
    catch { message.error('Ошибка экспорта'); } finally { setIsExporting(false); }
  };

  const handleResetFilters = () => { setFilters(defaultFilters); setFeedbackPage(1); };
  const hasActiveFilters = filters.dateRange !== null || filters.sentiment !== null || filters.authorId !== null || filters.recipientId !== null || filters.period !== 'month';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div><Title level={3} style={{ margin: 0 }}>Отчёты</Title><Text type="secondary">Детальные отчёты по обратной связи</Text></div>
        <Space wrap>
          <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExport} loading={isExporting} style={{ background: '#217346', borderColor: '#217346' }}>Экспорт Excel</Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={isLoading}>Обновить</Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 12, marginBottom: 16 }} bodyStyle={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Space align="center" size={4}><FilterOutlined style={{ color: '#8c8c8c' }} /><Text type="secondary" style={{ fontSize: 13 }}>Фильтры:</Text></Space>
          <Select value={filters.dateRange ? 'custom' : filters.period} onChange={(val) => { setFilters((f) => ({ ...f, period: val, dateRange: null })); setFeedbackPage(1); }} style={{ width: 130 }} options={[{ value: 'week', label: 'Неделя' }, { value: 'month', label: 'Месяц' }, { value: 'quarter', label: 'Квартал' }, { value: 'year', label: 'Год' }, { value: 'all', label: 'Всё время' }]} />
          <RangePicker value={filters.dateRange} onChange={(dates) => { setFilters((f) => ({ ...f, dateRange: dates as [Dayjs, Dayjs] | null })); setFeedbackPage(1); }} format="DD.MM.YYYY" placeholder={['Дата от', 'Дата до']} />
          <Divider type="vertical" />
          <Select value={filters.sentiment} onChange={(val) => { setFilters((f) => ({ ...f, sentiment: val })); setFeedbackPage(1); }} style={{ width: 150 }} placeholder="Тональность" allowClear options={[{ value: 'positive', label: '✅ Позитивный' }, { value: 'negative', label: '❌ Негативный' }]} />
          <Select value={filters.authorId} onChange={(val) => { setFilters((f) => ({ ...f, authorId: val })); setFeedbackPage(1); }} style={{ width: 180 }} placeholder="Автор" allowClear showSearch filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} options={colleagues.map((c) => ({ value: c.id, label: c.full_name }))} />
          <Select value={filters.recipientId} onChange={(val) => { setFilters((f) => ({ ...f, recipientId: val })); setFeedbackPage(1); }} style={{ width: 180 }} placeholder="Получатель" allowClear showSearch filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} options={colleagues.map((c) => ({ value: c.id, label: c.full_name }))} />
          {hasActiveFilters && <Button size="small" type="text" danger onClick={handleResetFilters}>Сбросить</Button>}
        </div>
      </Card>

      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <Tabs activeKey={activeTab} onChange={(k) => { setActiveTab(k as ReportTab); setFeedbackPage(1); }} style={{ padding: '0 24px' }} items={[
          { key: 'feedback', label: <Space><CalendarOutlined />Все отзывы{activeTab === 'feedback' && feedbackTotal > 0 && <Badge count={feedbackTotal} style={{ backgroundColor: '#1890ff' }} overflowCount={999} />}</Space>,
            children: <div style={{ padding: '0 0 24px' }}>{feedbackTotal > 0 && <div style={{ padding: '12px 24px', background: '#fafafa', borderRadius: 8, marginBottom: 16, display: 'flex', gap: 32, flexWrap: 'wrap' }}><Statistic title="Найдено" value={feedbackTotal} valueStyle={{ fontSize: 20 }} /><Statistic title="Позитивных" value={feedbackList.filter((f) => f.sentiment === 'positive').length} valueStyle={{ fontSize: 20, color: '#52c41a' }} prefix={<SmileOutlined />} /><Statistic title="Негативных" value={feedbackList.filter((f) => f.sentiment === 'negative').length} valueStyle={{ fontSize: 20, color: '#ff4d4f' }} prefix={<FrownOutlined />} /></div>}<div style={{ padding: '0 24px' }}><FeedbackTable data={feedbackList} loading={isLoading} total={feedbackTotal} page={feedbackPage} onPageChange={(p) => setFeedbackPage(p)} /></div></div> },
          { key: 'users', label: <Space><UserOutlined />По сотрудникам</Space>, children: <div style={{ padding: '0 24px 24px' }}>{userAnalytics.length === 0 && !isLoading ? <Empty description="Нет данных" style={{ padding: 40 }} /> : <UsersReportTable data={userAnalytics} loading={isLoading} />}</div> },
          { key: 'leaderboard', label: <Space><TeamOutlined />Лидерборд</Space>, children: <div style={{ padding: '0 24px 24px' }}>{leaderboard.length === 0 && !isLoading ? <Empty description="Нет данных" style={{ padding: 40 }} /> : <>
            {leaderboard.length >= 3 && <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>{leaderboard.slice(0, 3).map((entry) => { const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }; const colors: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' }; return <Col xs={24} sm={8} key={entry.user.id}><Card style={{ borderRadius: 12, textAlign: 'center', border: `2px solid ${colors[entry.rank]}40`, background: `${colors[entry.rank]}08` }} bodyStyle={{ padding: 20 }}><div style={{ fontSize: 36, marginBottom: 8 }}>{medals[entry.rank]}</div><Avatar size={56} style={{ backgroundColor: entry.user.avatar_color, marginBottom: 8 }}>{entry.user.initials}</Avatar><div style={{ fontWeight: 700, fontSize: 15 }}>{entry.user.short_name}</div><Text type="secondary" style={{ fontSize: 12 }}>{entry.user.position || '—'}</Text><div style={{ marginTop: 12 }}><Space size={4}><Tag color="success">+{entry.positive_received}</Tag><Tag color="error">-{entry.negative_received}</Tag></Space><div style={{ marginTop: 8, fontWeight: 600, color: entry.positive_rate >= 70 ? '#52c41a' : '#faad14' }}>{entry.positive_rate}% позитив</div></div></Card></Col>; })}</Row>}
            <LeaderboardTable data={leaderboard} loading={isLoading} />
          </>}</div> },
        ]} />
      </Card>
    </div>
  );
};

export default ReportsPage;