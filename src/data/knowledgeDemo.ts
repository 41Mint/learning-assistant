import type { KnowledgeEntry, KnowledgeLogLink, KnowledgeRelation, StudyLog } from '../types';
import type { CodeLink, CodeVersion } from '../types/projectCode';
import type { BackupFile } from '../utils/dataBackup';
import { restoreBackup } from '../utils/dataBackup';
import { imageMarkdown } from '../utils/imageStorage';
import { emptyKnowledge, validateKnowledge } from '../utils/knowledge';
import { effectiveCodeLinks, emptyProjectCode, entryCodeIds } from '../utils/projectCode';
import { readProjectCode } from '../utils/projectCodeStorage';
import { getStorageItem, getTodayDate, STORAGE_KEYS } from '../utils/storage';
import { IS_TEST_WORKSPACE, STORAGE_PREFIX } from '../utils/workspaceMode';
import { SKILL_PATH } from './skillPath';
import prefabDiagram from './demo-prefab.png?inline';

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
const DEMO_VERSION = '3';
const FIXTURE_TIME = Date.UTC(2026, 9, 1);

const entryId = (topic: number, term: number) => `demo-entry-${topic}-${term}`;
const logId = (topic: number, log: number) => `demo-log-${topic}-${log}`;
const versionId = (topic: number, version: number) => `demo-code-${topic}-${version}`;
const sharedLog: KnowledgeLogLink = {
  id: 'demo-shared-sprite-collision-log', logId: logId(0, 0), entryId: entryId(3, 0),
  note: '练习中对照了精灵的显示大小和碰撞范围。',
};
const sharedVersionId = versionId(0, 0);
const projectId = 'demo-unity-project';
const prefabEntryId = entryId(1, 3);
const prefabLogId = logId(1, 1);
const prefabVersionId = versionId(1, 1);
const prefabPath = 'Assets/Scripts/PickupSpawner.cs';
const prefabImageId = 'demo-prefab-check';
const prefabSources = { logIds: [prefabLogId], entryIds: [prefabEntryId], codeVersionIds: [prefabVersionId] };
const prefabCode = `using UnityEngine;

public class PickupSpawner : MonoBehaviour
{
    [SerializeField] private GameObject pickupPrefab;

    public void SpawnPickup()
    {
        Instantiate(pickupPrefab, transform.position, Quaternion.identity);
    }
}`;

function prefabLearningData(): Pick<BackupFile['data'], 'growth' | 'tasks' | 'skillTree' | 'currentGoal'> {
  const topicId = 'demo-prefab-topic';
  const outcomeId = 'demo-prefab-reuse';
  const exerciseId = 'demo-prefab-overrides';
  const taskId = 'demo-prefab-task-update';
  return {
    growth: {
      version: 1, hiddenPresetIds: [],
      outcomes: [{
        id: outcomeId, title: '在两个场景复用拾取物预制体', domains: ['Unity'],
        description: '从同一个预制体生成拾取物，验证两个场景的引用和生成位置。',
        practices: [
          { id: 'demo-prefab-practice-a', date: '2026-10-05', note: '将拾取物保存为预制体，两个场景的生成器都引用 Project 中的同一个资源。', ...prefabSources },
          { id: 'demo-prefab-practice-b', date: '2026-10-06', note: '修改了第二个生成点的位置，并确认拾取物跟着生成点移动。', ...prefabSources },
        ],
      }],
      exercises: [
        { id: exerciseId, title: '观察预制体实例的覆盖值', domains: ['Unity'], action: '调整场景 B 的拾取物实例尺寸，再修改预制体的同一属性。',
          done: '对比两个场景，说明哪个实例保留了覆盖值。', sources: prefabSources },
        { id: 'demo-pickup-limit', title: '让生成器只保留一个拾取物', domains: ['Unity', 'C#'], action: '保存当前实例的引用，已有实例时先跳过生成。',
          done: '多次触发生成时，场景中只有一个拾取物。', sources: prefabSources },
      ],
      groups: [{ id: 'demo-prefab-group', name: '预制体与场景复用', cardIds: [outcomeId, exerciseId] }],
    },
    tasks: [
      { id: 'demo-prefab-task-create', parentSkillId: topicId, title: '创建拾取物预制体', description: '在 Project 窗口保存 Pickup，并确认两处生成器引用相同的资源。',
        completed: true, createdAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME },
      { id: taskId, parentSkillId: topicId, title: '验证预制体更新会影响哪些实例', description: '改动预制体的尺寸，比较场景 A 和场景 B 的表现。',
        completed: false, createdAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME },
    ],
    skillTree: {
      version: 1, completedIds: ['csharp-foundations'],
      topics: [...SKILL_PATH, { id: topicId, name: '预制体与场景复用', category: 'Unity',
        description: '在两个场景复用同一个拾取物预制体，观察实例覆盖与资源更新。', prerequisites: ['unity-foundations'], estimatedTime: 1 }],
    },
    currentGoal: { version: 2, goal: { type: 'task', id: taskId, label: '验证预制体更新会影响哪些实例' } },
  };
}

function demoBackup(): BackupFile {
  const entries: KnowledgeEntry[] = [];
  const studyLogs: StudyLog[] = [];
  const logLinks: KnowledgeLogLink[] = [];
  const relations: KnowledgeRelation[] = [];
  const versions: CodeVersion[] = [];
  const codeLinks: CodeLink[] = [];
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
        id, title, category, aliases: title === '像素单位' ? ['PPU', 'Pixels Per Unit'] : id === prefabEntryId ? ['Prefab'] : [],
        content: id === prefabEntryId ? '## 预制体\n\n预制体把对象和组件保存为可复用资源。修改源资源后，可以在场景里对比普通实例和有覆盖值的实例。'
          : `## ${title}\n\n这是「${category}」中的演示词条。可以在知识网络中查看它与其他概念的联系。`,
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
      const content = id === prefabLogId
        ? [
          '# 在两个场景验证预制体引用',
          '把拾取物拖入 Project 窗口保存为 Pickup 预制体。两个场景各放一个 PickupSpawner，引用同一个资源。',
          imageMarkdown(prefabImageId, '拾取物预制体与两个场景实例示意图'),
          '分别运行两个场景，检查生成位置。下一步比较实例覆盖尺寸后，源资源更新会影响哪一个场景。',
        ].join('\n\n')
        : `# ${category}练习 ${log + 1}\n\n记录 ${terms[log * 2]} 与 ${terms[log * 2 + 1]} 的实践。`;
      studyLogs.push({ id, date, content,
        tags: [category], knowledgePoints: [], duration: 25 + log * 15, createdAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME });
      for (let offset = 0; offset < 3; offset += 1) {
        logLinks.push({ id: `${id}-entry-${offset}`, logId: id, entryId: entryId(topic, log * 2 + offset), note: `在${category}练习中记录。` });
      }
    }
    for (let version = 0; version < 2; version += 1) {
      const id = versionId(topic, version);
      const className = `DemoExample${topic + 1}_${version + 1}`;
      const prefabSnapshot = id === prefabVersionId;
      versions.push({ id, projectId, path: prefabSnapshot ? prefabPath : `Assets/Scripts/${className}.cs`,
        content: prefabSnapshot ? prefabCode : `public class ${className}\n{\n    public int Samples => ${version + 1};\n}`,
        githubUrl: '', note: prefabSnapshot ? '在生成器的位置实例化拾取物预制体。' : `${category}代码示例 ${version + 1}`,
        savedAt: FIXTURE_TIME + topic * 3600000 + version * 60000 });
      codeLinks.push({ versionId: id, target: { kind: 'log', id: logId(topic, version) } });
      if (version === 0) codeLinks.push({ versionId: id, target: { kind: 'entry', id: entryId(topic, 0) } });
    }
  });

  // The same sources are used by 2D 渲染 and 物理与碰撞 in module comparison.
  logLinks.push(sharedLog);
  codeLinks.push({ versionId: sharedVersionId, target: { kind: 'entry', id: sharedLog.entryId } });

  const today = getTodayDate();
  if (!studyLogs.some(({ date }) => date === today)) {
    studyLogs.push({ id: 'demo-today-log', date: today, duration: 25, createdAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME,
      tags: ['Unity', 'Prefab'], knowledgePoints: [],
      content: '# 检查预制体实例\n\n今天准备对比两个场景的拾取物尺寸。先记录源资源的默认值，再查看场景 B 的覆盖值。' });
  }

  const deletedAt = FIXTURE_TIME + 9 * 86400000;
  const trashedEntryId = 'demo-trashed-prefab-entry';
  const trashedVersionId = 'demo-trashed-prefab-code';
  return {
    format: 'learning-assistant-backup', version: 9, exportedAt: new Date(FIXTURE_TIME).toISOString(),
    images: [{ id: prefabImageId, name: 'prefab-instance-check.png', type: 'image/png', base64: prefabDiagram.split(',')[1] }],
    data: {
      ...prefabLearningData(),
      studyLogs,
      trashedLogs: [{ id: 'demo-trashed-prefab-log', date: '2026-09-30', duration: 15, tags: ['Unity'], knowledgePoints: [],
        content: '# 拾取物原型草稿\n\n记录场景加载时的第一次生成验证。', createdAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME, deletedAt }],
      streak: { currentStreak: 1, longestStreak: 24, lastStudyDate: today, totalDays: studyLogs.length },
      settings: null, pomodoroToday: null,
      knowledge: { ...emptyKnowledge(), entries, logLinks, relations, trash: {
        entries: [{ id: trashedEntryId, title: '早期生成器参数', aliases: [], category: '场景与资源',
          content: '原型阶段用固定生成位置，后续迁移到场景中的生成点。', createdAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME, deletedAt }],
        logLinks: [{ id: 'demo-trashed-entry-log-link', entryId: trashedEntryId, logId: prefabLogId, note: '可与当前方案对照。' }],
        relations: [{ id: 'demo-trashed-entry-relation', sourceId: trashedEntryId, targetId: prefabEntryId }],
      } },
      projectCode: { ...emptyProjectCode(), projects: [{ id: projectId, name: 'Unity 学习演示', repositoryUrl: '', tutorialUrl: '' }],
        versions, links: codeLinks, trash: {
          versions: [{ id: trashedVersionId, projectId, path: prefabPath, githubUrl: '', note: '旧版使用固定坐标生成。',
            content: prefabCode.replace('transform.position', 'Vector3.zero'), savedAt: FIXTURE_TIME, deletedAt }],
          links: [{ versionId: trashedVersionId, target: { kind: 'log', id: 'demo-trashed-prefab-log' } }],
        } },
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

export async function prepareTestWorkspace(reset = false): Promise<void> {
  if (!IS_TEST_WORKSPACE) throw new Error('请在测试工作区加载示例数据。');
  const seed = async () => {
    const version = localStorage.getItem(DEMO_MARKER);
    if (!reset && version) {
      if (version === '1') {
        try {
          await upgradeSharedDemoSources();
          localStorage.setItem(DEMO_MARKER, '2');
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
