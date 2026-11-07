import type { GrowthDomain } from '../types';

export const GROWTH_DOMAINS: readonly GrowthDomain[] = ['Unity', 'C#', '算法', '图形学', '其他'];

interface GrowthPreset {
  id: string;
  title: string;
  domains: GrowthDomain[];
  cue: string;
}

export const GROWTH_PRESETS: GrowthPreset[] = [
  { id: 'preset-pixel-sprite', title: '在场景中清晰显示像素素材', domains: ['Unity'], cue: '运行场景并观察素材边缘。可以从 PPU 和过滤方式入手。' },
  { id: 'preset-sprite-slice', title: '从一张图集切出可用的精灵', domains: ['Unity'], cue: '从图集中切出多个区域，并把其中一块单独放到场景里。' },
  { id: 'preset-tilemap', title: '用 Tilemap 画出一段地面', domains: ['Unity'], cue: '在场景里看到自己用多块瓦片绘制的地面。' },
  { id: 'preset-move', title: '让角色左右移动并停下来', domains: ['Unity', 'C#'], cue: '运行场景，试试按键移动和松开后停止。可以参考输入和位置更新。' },
  { id: 'preset-jump', title: '让角色跳起并落回地面', domains: ['Unity', 'C#'], cue: '运行场景并完成一次跳跃与落地。碰撞和落地判断可以作为参考。' },
  { id: 'preset-animation', title: '让角色在待机和移动动作间切换', domains: ['Unity', 'C#'], cue: '运行场景，移动和停下时能看到不同的动作。' },
  { id: 'preset-count-items', title: '用字典统计物品数量', domains: ['C#'], cue: '输入一组含重复项的物品，输出每种物品的数量。' },
  { id: 'preset-event', title: '让一个事件触发两种反馈', domains: ['C#'], cue: '例如拾取物品时触发一个事件，让两个订阅者分别更新计数和显示提示。' },
];
