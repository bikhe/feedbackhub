import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Tag,
  Avatar,
  Table,
  Progress,
  Empty,
  Spin,
  Segmented,
  Tooltip,
  Space,
} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  UserOutlined,
  SmileOutlined,
  FrownOutlined,
  TrophyOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { analyticsApi } from '../api/analytics';
import {
  AnalyticsSummary,
  UserAnalytics,
  LeaderboardEntry,
  TagAnalytics,
  TrendPoint,
} from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

const { Title, Text } = Typography;

// ── Типы ──────────────────────────────────────────────────────────────────────
type PeriodKey = 'week' | 'month' | 'quarter' | 'year';

const PERIOD_OPTIONS = [
  { label: 'Неделя', value: 'week' },
  { label: 'Месяц', value: 'month' },
  { label: 'Квартал', value: 'quarter' },
  { label: 'Год', value: 'year' },
];

const CHART_COLORS = {
  positive: '#52c41a',
  negative: '#ff4d4f',
  total: '#1890ff',
};

const PIE_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#ff4d4f',
  '#722ed1', '#13c2c2', '#fa8c16', '#eb2f96',
  '#a0d911', '#096dd9',
];

// ── StatCard ──────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  title: string;
  value: number | string;
  suffix?: string;
  color?: string;
  icon?: React.ReactNode;
  description?: string;
}> = ({ title, value, suffix, color, icon, description }) => (
  <Card
    style={{ borderRadius: 12, height: '100%' }}
    bodyStyle={{ padding: '20px 24px' }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
        <div style={{ fontSize: 32, fontWeight: 700, color: color || '#1a1a2e', lineHeight: 1.2, marginTop: 4 }}>
          {value}
          {suffix && <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>{suffix}</span>}
        </div>
        {description && (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>{description}</Text>
        )}
      </div>
      {icon && (
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: (color || '#1890ff') + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: color || '#1890ff', flexShrink: 0,
        }}>
          {icon}
        </div>
      )}
    </div>
  </Card>
);

// ── TrendsChart ───────────────────────────────────────────────────────────────
const TrendsChart: React.FC<{ data: TrendPoint[] }> = ({ data }) => {
  if (!data.length) return <Empty description="Нет данных" style={{ padding: 40 }} />;

  const formatted = data.map((d) => ({ ...d, date: dayjs(d.date).format('DD MMM') }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <RechartTooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
        <Legend />
        <Line type="monotone" dataKey="total" name="Всего" stroke={CHART_COLORS.total} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="positive" name="Позитивных" stroke={CHART_COLORS.positive} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="negative" name="Негативных" stroke={CHART_COLORS.negative} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── UserBarChart ──────────────────────────────────────────────────────────────
const UserBarChart: React.FC<{ data: UserAnalytics[] }> = ({ data }) => {
  if (!data.length) return <Empty description="Нет данных" style={{ padding: 40 }} />;

  const formatted = data.slice(0, 10).map((d) => ({
    name: d.user.short_name,
    positive: d.positive_received,
    negative: d.negative_received,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <RechartTooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
        <Legend wrapperStyle={{ paddingTop: 16 }} />
        <Bar dataKey="positive" name="Позитивных" fill={CHART_COLORS.positive} radius={[4, 4, 0, 0]} />
        <Bar dataKey="negative" name="Негативных" fill={CHART_COLORS.negative} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── TagsPieChart ──────────────────────────────────────────────────────────────
const TagsPieChart: React.FC<{ data: TagAnalytics[] }> = ({ data }) => {
  if (!data.length) return <Empty description="Нет данных" style={{ padding: 40 }} />;

  const top = data.slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={top}
          dataKey="count"
          nameKey="tag.name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={50}
          paddingAngle={2}
          labelLine={false}
        >
          {top.map((entry, index) => (
            <Cell key={entry.tag.id} fill={entry.tag.color || PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <RechartTooltip
          formatter={(...args: any[]) => {
            const value = args[0];
            const name = args[1];
            const props = args[2];
            return [
              `${value ?? 0} (${props?.payload?.percentage?.toFixed(1) ?? 0}%)`,
              props?.payload?.tag?.name ?? name,
            ];
          }}
          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ── UserAnalyticsTable ────────────────────────────────────────────────────────
const UserAnalyticsTable: React.FC<{ data: UserAnalytics[] }> = ({ data }) => {
  const columns = [
    {
      title: 'Сотрудник',
      key: 'user',
      render: (_: any, record: UserAnalytics) => (
        <Space>
          <Avatar style={{ backgroundColor: record.user.avatar_color }} size={36}>{record.user.initials}</Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{record.user.full_name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.user.position || record.user.department}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Получено',
      key: 'received',
      sorter: (a: UserAnalytics, b: UserAnalytics) => a.received - b.received,
      render: (_: any, record: UserAnalytics) => (
        <Space size={4}>
          <Tag color="success" style={{ margin: 0 }}>+{record.positive_received}</Tag>
          <Tag color="error" style={{ margin: 0 }}>-{record.negative_received}</Tag>
        </Space>
      ),
    },
    {
      title: 'Отдано',
      dataIndex: 'given',
      key: 'given',
      sorter: (a: UserAnalytics, b: UserAnalytics) => a.given - b.given,
      render: (val: number) => <Text style={{ fontWeight: 500 }}>{val}</Text>,
    },
    {
      title: 'Позитивность',
      key: 'positive_rate',
      sorter: (a: UserAnalytics, b: UserAnalytics) => a.positive_rate - b.positive_rate,
      render: (_: any, record: UserAnalytics) => (
        <div style={{ minWidth: 120 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 12 }}>{record.positive_rate}%</Text>
          </div>
          <Progress
            percent={record.positive_rate}
            showInfo={false}
            size="small"
            strokeColor={record.positive_rate >= 70 ? '#52c41a' : record.positive_rate >= 50 ? '#faad14' : '#ff4d4f'}
          />
        </div>
      ),
    },
    {
      title: 'Топ теги',
      key: 'tags',
      render: (_: any, record: UserAnalytics) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {record.tags?.slice(0, 2).map((tag) => (
            <span key={tag.id} style={{
              background: tag.color + '20', border: `1px solid ${tag.color}40`,
              color: tag.color, borderRadius: 4, padding: '1px 6px', fontSize: 11,
            }}>
              {tag.icon} {tag.name}
            </span>
          ))}
        </div>
      ),
    },
  ];

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey={(r) => r.user.id}
      pagination={{ pageSize: 10, showSizeChanger: false }}
      size="middle"
      scroll={{ x: 700 }}
    />
  );
};

// ── LeaderboardList ───────────────────────────────────────────────────────────
const LeaderboardList: React.FC<{ data: LeaderboardEntry[] }> = ({ data }) => {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div>
      {data.map((entry) => (
        <div key={entry.user.id} style={{
          display: 'flex', alignItems: 'center', padding: '12px 0',
          borderBottom: '1px solid #f0f0f0', gap: 12,
        }}>
          <div style={{
            width: 32, textAlign: 'center',
            fontSize: entry.rank <= 3 ? 20 : 14, fontWeight: 700,
            color: entry.rank <= 3 ? undefined : '#8c8c8c', flexShrink: 0,
          }}>
            {medals[entry.rank] || `#${entry.rank}`}
          </div>
          <Avatar style={{ backgroundColor: entry.user.avatar_color, flexShrink: 0 }} size={40}>
            {entry.user.initials}
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.user.full_name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{entry.user.position || entry.user.department}</Text>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <Space size={4}>
              <Tooltip title="Позитивных">
                <Tag color="success" style={{ margin: 0 }}>+{entry.positive_received}</Tag>
              </Tooltip>
              {entry.negative_received > 0 && (
                <Tooltip title="Негативных">
                  <Tag color="error" style={{ margin: 0 }}>-{entry.negative_received}</Tag>
                </Tooltip>
              )}
            </Space>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{entry.positive_rate}% позитив</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Главный компонент ─────────────────────────────────────────────────────────
const AnalyticsPage: React.FC = () => {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'users' | 'tags'>('overview');

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tagAnalytics, setTagAnalytics] = useState<TagAnalytics[]>([]);

  const getParams = useCallback(() => {
    return { period };
  }, [period]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = getParams();
      const [summaryRes, trendsRes, usersRes, leaderboardRes, tagsRes] =
        await Promise.all([
          analyticsApi.summary(params),
          analyticsApi.trends({ ...params, group_by: period === 'year' ? 'month' : 'day' }),
          analyticsApi.byUser(params),
          analyticsApi.leaderboard({ ...params, limit: 10 }),
          analyticsApi.tags(params),
        ]);

      setSummary(summaryRes);
      setTrends(trendsRes);
      setUserAnalytics(usersRes);
      setLeaderboard(leaderboardRes);
      setTagAnalytics(tagsRes);
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getParams, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div>
      {/* Заголовок */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Аналитика</Title>
          <Text type="secondary">Статистика обратной связи в команде</Text>
        </div>
        <Space wrap>
          <Segmented options={PERIOD_OPTIONS} value={period} onChange={(val) => setPeriod(val as PeriodKey)} />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={isLoading}>Обновить</Button>
        </Space>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* Карточки сводки */}
          {summary && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={12} sm={8} lg={4}>
                <StatCard title="Всего отзывов" value={summary.total_feedback} color="#1890ff" icon={<SmileOutlined />} />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <StatCard title="Позитивных" value={summary.positive_feedback} color="#52c41a" icon={<ArrowUpOutlined />} />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <StatCard title="Негативных" value={summary.negative_feedback} color="#ff4d4f" icon={<ArrowDownOutlined />} />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <StatCard
                  title="Позитивность" value={summary.positive_rate} suffix="%"
                  color={summary.positive_rate >= 70 ? '#52c41a' : summary.positive_rate >= 50 ? '#faad14' : '#ff4d4f'}
                  icon={<TrophyOutlined />}
                  description={summary.positive_rate >= 70 ? 'Отличный результат!' : 'Есть куда расти'}
                />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <StatCard title="Активных задач" value={summary.active_tasks} color="#722ed1" icon={<FrownOutlined />} description={`из ${summary.total_tasks} всего`} />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <StatCard title="Активных пользователей" value={summary.active_users} color="#13c2c2" icon={<TeamOutlined />} description={`из ${summary.total_users} всего`} />
              </Col>
            </Row>
          )}

          {/* Переключатель вида */}
          <div style={{ marginBottom: 20 }}>
            <Segmented
              options={[
                { label: 'Обзор', value: 'overview' },
                { label: 'По сотрудникам', value: 'users' },
                { label: 'По тегам', value: 'tags' },
              ]}
              value={activeView}
              onChange={(val) => setActiveView(val as typeof activeView)}
            />
          </div>

          {/* Обзор */}
          {activeView === 'overview' && (
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <Card title="Динамика отзывов" style={{ borderRadius: 12 }} bodyStyle={{ padding: '16px 24px 24px' }}>
                  <TrendsChart data={trends} />
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card
                  title={<Space><TrophyOutlined style={{ color: '#faad14' }} />Лидерборд</Space>}
                  style={{ borderRadius: 12 }} bodyStyle={{ padding: '0 24px' }}
                >
                  {leaderboard.length ? (
                    <LeaderboardList data={leaderboard.slice(0, 7)} />
                  ) : (
                    <Empty description="Нет данных" style={{ padding: 32 }} />
                  )}
                </Card>
              </Col>
              <Col xs={24}>
                <Card title="Отзывы по сотрудникам" style={{ borderRadius: 12 }} bodyStyle={{ padding: '16px 24px 24px' }}>
                  <UserBarChart data={userAnalytics} />
                </Card>
              </Col>
            </Row>
          )}

          {/* По сотрудникам */}
          {activeView === 'users' && (
            <Card
              title={<Space><UserOutlined />Аналитика по сотрудникам<Tag>{userAnalytics.length}</Tag></Space>}
              style={{ borderRadius: 12 }}
            >
              <UserAnalyticsTable data={userAnalytics} />
            </Card>
          )}

          {/* По тегам */}
          {activeView === 'tags' && (
            <Row gutter={[16, 16]}>
              <Col xs={24} md={10}>
                <Card title="Распределение тегов" style={{ borderRadius: 12 }} bodyStyle={{ padding: '16px 24px' }}>
                  <TagsPieChart data={tagAnalytics} />
                </Card>
              </Col>
              <Col xs={24} md={14}>
                <Card title="Популярные теги" style={{ borderRadius: 12 }}>
                  <div>
                    {tagAnalytics.length === 0 ? (
                      <Empty description="Нет данных" />
                    ) : (
                      tagAnalytics.map((item, idx) => (
                        <div key={item.tag.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                          borderBottom: idx < tagAnalytics.length - 1 ? '1px solid #f0f0f0' : 'none',
                        }}>
                          <Text type="secondary" style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</Text>
                          <span style={{ fontSize: 20, flexShrink: 0 }}>{item.tag.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text strong style={{ fontSize: 13 }}>{item.tag.name}</Text>
                              <Space size={8}>
                                <Text type="secondary" style={{ fontSize: 12 }}>{item.count} раз</Text>
                                <Tag color={item.tag.sentiment === 'positive' ? 'success' : 'error'} style={{ margin: 0 }}>
                                  {item.percentage.toFixed(1)}%
                                </Tag>
                              </Space>
                            </div>
                            <Progress percent={item.percentage} showInfo={false} size="small" strokeColor={item.tag.color} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;