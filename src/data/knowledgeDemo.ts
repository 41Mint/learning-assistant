import type { KnowledgeEntry, KnowledgeLogLink, KnowledgeRelation, StudyLog } from '../types';
import type { CodeLink, CodeVersion } from '../types/projectCode';
import type { BackupFile } from '../utils/dataBackup';
import { restoreBackup } from '../utils/dataBackup';
import { emptyGrowth } from '../utils/growth';
import { validateKnowledge } from '../utils/knowledge';
import { effectiveCodeLinks, entryCodeIds } from '../utils/projectCode';
import { readProjectCode } from '../utils/projectCodeStorage';
import { getStorageItem, STORAGE_KEYS } from '../utils/storage';
import { IS_KNOWLEDGE_DEMO, STORAGE_PREFIX } from '../utils/workspaceMode';

const TOPICS = [
  { category: '2D 渲染', terms: ['像素单位', '精灵切片', '精灵图集', '瓦片地图', '排序层', '正交相机', '纹理采样', '透明度', '材质', '精灵遮罩', '批处理', '光照'] },
  { category: '场景与资源', terms: ['场景加载', '游戏对象', '组件', '预制体', '实例化', '资源引用', '可寻址资源', '对象池', '层级结构', '序列化', '资源导入', '命名约定'] },
  { category: '输入与交互', terms: ['指针输入', '输入系统', '输入动作', '屏幕坐标', '世界坐标', '拖拽', '手柄映射', '触摸输入', '交互状态', '点击判定', '输入缓冲', '快捷键'] },
  { category: '物理与碰撞', terms: ['碰撞检测', '射线检测', '刚体', '碰撞体', '触发器', '物理材质', '力与冲量', '摩擦力', '物理层', '固定时间步', '碰撞回调', '移动约束'] },
  { category: '动画与状态', terms: ['状态机', '动画片段', '动画控制器', '过渡条件', '混合树', '动画事件', '关键帧', '动画曲线', '根运动', '骨骼绑定', '待机循环', '受击反馈'] },
  { category: '界面与反馈', terms: ['画布', '锚点', '矩形变换', '布局组', '文本渲染', '焦点导航', '进度条', '提示消息', '音效触发', '粒子反馈', '分辨率适配', '交互高亮'] },
  { category: 'C# 基础', terms: ['事件', '委托', '接口', '继承', '泛型', '属性', '集合', '字典', '协程', '异常处理', '引用类型', '扩展方法'] },
  { category: '调试与性能', terms: ['断点', '日志等级', '性能分析', '内存快照', '帧率', '资源释放', '异步加载', '回归测试', '复现步骤', '版本比较', '构建配置', '待补充的实验'] },
];
const DEMO_MARKER = STORAGE_PREFIX + 'knowledge-demo-seeded';
const DEMO_VERSION = '2';
const FIXTURE_TIME = Date.UTC(2026, 9, 1);

const entryId = (topic: number, term: number) => `demo-entry-${topic}-${term}`;
const logId = (topic: number, log: number) => `demo-log-${topic}-${log}`;
const versionId = (topic: number, version: number) => `demo-code-${topic}-${version}`;
const sharedLog: KnowledgeLogLink = {
  id: 'demo-shared-sprite-collision-log', logId: logId(0, 0), entryId: entryId(3, 0),
  note: '练习中对照了精灵的显示大小和碰撞范围。',
};
const sharedVersionId = versionId(0, 0);

function demoBackup(): BackupFile {
  const entries: KnowledgeEntry[] = [];
  const studyLogs: StudyLog[] = [];
  const logLinks: KnowledgeLogLink[] = [];
  const relations: KnowledgeRelation[] = [];
  const versions: CodeVersion[] = [];
  const codeLinks: CodeLink[] = [];
  const projectId = 'demo-unity-project';
  const pairs = new Set<string>();
  const isolated = entryId(TOPICS.length - 1, 11);
  const addRelation = (sourceId: string, targetId: string, label: string) => {
    if (sourceId === isolated || targetId === isolated) return;
    const pair = JSON.stringify([sourceId, targetId].sort());
    if (pairs.has(pair)) return;
    pairs.add(pair);
    relations.push({ id: `demo-relation-${relations.length}`, sourceId, targetId, annotation: { label, note: '用于检查知识网络中的关联路径。' } });
  };

  TOPICS.forEach(({ category, terms }, topic) => {
    terms.forEach((title, term) => {
      const id = entryId(topic, term);
      entries.push({
        id, title, category, aliases: title === '像素单位' ? ['PPU', 'Pixels Per Unit'] : [],
        content: `## ${title}\n\n这是「${category}」中的演示词条。可以在知识网络中查看它与其他概念的联系。`,
        createdAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME,
      });
      if (term > 0) addRelation(entryId(topic, term - 1), id, '学习顺序');
      if (term >= 3) addRelation(entryId(topic, term - 3), id, '共同使用');
      if (term < 8) addRelation(id, entryId((topic + 1) % TOPICS.length, (term + 4) % terms.length), '跨分类');
      if (topic > 0 && term < 3) addRelation(entryId(0, 0), id, '练习线索');
    });
    for (let log = 0; log < 3; log += 1) {
      const id = logId(topic, log);
      const date = `2026-10-${String(topic * 3 + log + 1).padStart(2, '0')}`;
      studyLogs.push({ id, date, content: `# ${category}练习 ${log + 1}\n\n记录 ${terms[log * 2]} 与 ${terms[log * 2 + 1]} 的实践。`,
        tags: [category], knowledgePoints: [], duration: 25 + log * 15, createdAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME });
      for (let offset = 0; offset < 3; offset += 1) {
        logLinks.push({ id: `${id}-entry-${offset}`, logId: id, entryId: entryId(topic, log * 2 + offset), note: `在${category}练习中记录。` });
      }
    }
    for (let version = 0; version < 2; version += 1) {
      const id = versionId(topic, version);
      const className = `DemoExample${topic + 1}_${version + 1}`;
      versions.push({ id, projectId, path: `Assets/Scripts/${className}.cs`, content: `public class ${className}\n{\n    public int Samples => ${version + 1};\n}`,
        githubUrl: '', note: `${category}代码示例 ${version + 1}`, savedAt: FIXTURE_TIME + topic * 3600000 + version * 60000 });
      codeLinks.push({ versionId: id, target: { kind: 'log', id: logId(topic, version) } });
      if (version === 0) codeLinks.push({ versionId: id, target: { kind: 'entry', id: entryId(topic, 0) } });
    }
  });

  // The same sources are used by 2D 渲染 and 物理与碰撞 in module comparison.
  logLinks.push(sharedLog);
  codeLinks.push({ versionId: sharedVersionId, target: { kind: 'entry', id: sharedLog.entryId } });

  return {
    format: 'learning-assistant-backup', version: 5, exportedAt: new Date(FIXTURE_TIME).toISOString(), images: [],
    data: {
      studyLogs, tasks: [], skillTree: null, currentGoal: null, streak: null, settings: null, pomodoroToday: null,
      knowledge: { version: 1, entries, logLinks, relations }, growth: emptyGrowth(),
      projectCode: { version: 1, projects: [{ id: projectId, name: 'Unity 学习演示', repositoryUrl: '', tutorialUrl: '' }], versions, links: codeLinks },
    },
  };
}

async function upgradeSharedDemoSources() {
  const code = await readProjectCode();
  const raw = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE);
  if (!raw) return;
  const knowledge = validateKnowledge(JSON.parse(raw));
  const collision = knowledge.entries.find(({ id }) => id === sharedLog.entryId);
  const sprite = knowledge.entries.find(({ id }) => id === entryId(0, 0));
  if (collision?.category !== TOPICS[3].category || sprite?.category !== TOPICS[0].category) return;

  // Newer samples initially used the same marker. Their existing links identify them even after a canonical code edit.
  if (knowledge.logLinks.some(({ id }) => id === sharedLog.id) || code.links.some(({ versionId, target }) =>
    versionId === sharedVersionId && target.kind === 'entry' && target.id === collision.id)) return;

  const logs = getStorageItem<StudyLog[]>(STORAGE_KEYS.STUDY_LOGS, []);
  const logExists = Array.isArray(logs) && logs.some(({ id }) => id === sharedLog.logId);
  const addLog = logExists && knowledge.logLinks.some(({ logId, entryId }) => logId === sharedLog.logId && entryId === sprite.id)
    && !knowledge.logLinks.some(({ logId, entryId }) => logId === sharedLog.logId && entryId === collision.id);
  const previousIds = entryCodeIds(collision, code.links);
  const addCode = code.versions.some(({ id }) => id === sharedVersionId) && entryCodeIds(sprite, code.links).includes(sharedVersionId)
    && !previousIds.includes(sharedVersionId);
  if (!addLog && !addCode) return;

  const codeAnnotations = collision.codeAnnotations ?? effectiveCodeLinks(code, [], [collision]).flatMap(({ target, versionId, annotation }) =>
    target.kind === 'entry' && target.id === collision.id && annotation ? [{ versionId, annotation }] : []);
  const next = validateKnowledge({
    ...knowledge,
    entries: addCode ? knowledge.entries.map((entry) => entry === collision ? {
      ...entry, codeVersionIds: [...previousIds, sharedVersionId], codeAnnotations,
    } : entry) : knowledge.entries,
    logLinks: addLog ? [...knowledge.logLinks, sharedLog] : knowledge.logLinks,
  });
  localStorage.setItem(STORAGE_KEYS.KNOWLEDGE, JSON.stringify(next));
}

export async function prepareKnowledgeDemo(reset = false): Promise<void> {
  if (!IS_KNOWLEDGE_DEMO) throw new Error('请在演示工作区加载示例数据。');
  const seed = async () => {
    const version = localStorage.getItem(DEMO_MARKER);
    if (!reset && version) {
      if (version === '1') {
        try {
          await upgradeSharedDemoSources();
          localStorage.setItem(DEMO_MARKER, DEMO_VERSION);
        } catch (error) { console.warn('演示样例关联补充失败。', error); }
      }
      return;
    }
    await restoreBackup(demoBackup());
    localStorage.setItem(DEMO_MARKER, DEMO_VERSION);
  };
  if (navigator.locks) await navigator.locks.request(DEMO_MARKER, seed);
  else await seed();
}
