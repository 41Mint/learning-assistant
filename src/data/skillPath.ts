import type { SkillNode } from '../types';

export type SkillNodeDefinition = Omit<SkillNode, 'status' | 'progress'>;

export const SKILL_CATEGORIES = [
  {
    id: 'C#',
    title: 'C# 基础',
    description: '掌握 Unity 客户端开发所需的语言和面向对象基础。',
  },
  {
    id: 'Unity',
    title: 'Unity 客户端',
    description: '从引擎基础到可展示的玩法原型。',
  },
  {
    id: '算法',
    title: '算法与问题解决',
    description: '保持算法手感，并把它连接到游戏场景。',
  },
  {
    id: '图形学',
    title: '图形学 / 引擎工具（探索）',
    description: '在客户端基础稳定后，探索渲染与编辑器工具方向。',
  },
] as const;

export const SKILL_PATH: SkillNodeDefinition[] = [
  {
    id: 'csharp-foundations',
    name: 'C# 与面向对象基础',
    description: '掌握类、接口、集合、事件与基础调试，为 Unity 脚本开发打底。',
    category: 'C#',
    prerequisites: [],
    estimatedTime: 12,
  },
  {
    id: 'algorithm-foundations',
    name: '算法基础保持',
    description: '围绕数组、哈希、搜索与图遍历，持续练习游戏开发常见问题。',
    category: '算法',
    prerequisites: [],
    estimatedTime: 10,
  },
  {
    id: 'unity-foundations',
    name: 'Unity 核心工作流',
    description: '理解场景、GameObject、组件、Prefab、生命周期和 2D UI。',
    category: 'Unity',
    prerequisites: ['csharp-foundations'],
    estimatedTime: 16,
  },
  {
    id: 'tower-defense-prototype',
    name: '塔防核心玩法原型',
    description: '完成网格、波次、路径跟随、部署与自动攻击的最小可玩闭环。',
    category: 'Unity',
    prerequisites: ['unity-foundations', 'algorithm-foundations'],
    estimatedTime: 24,
  },
  {
    id: 'unity-editor-tools',
    name: 'Unity 编辑器工具入门',
    description: '用 Editor 脚本制作一个小型配置或关卡辅助工具。',
    category: 'Unity',
    prerequisites: ['unity-foundations'],
    estimatedTime: 10,
  },
  {
    id: 'graphics-foundations',
    name: '图形学与渲染管线基础',
    description: '学习向量、矩阵、坐标变换和光栅化管线，判断自己是否喜欢底层方向。',
    category: '图形学',
    prerequisites: ['csharp-foundations'],
    estimatedTime: 16,
  },
  {
    id: 'rendering-or-tool-practice',
    name: '渲染或工具实践',
    description: '选择一个小练习：渲染三角形、Shader 效果或资产处理工具。',
    category: '图形学',
    prerequisites: ['graphics-foundations'],
    estimatedTime: 20,
  },
];

export function getSkillNode(id: string) {
  return SKILL_PATH.find((node) => node.id === id);
}
