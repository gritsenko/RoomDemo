import { CardItem } from './game';

export const INITIAL_CARDS: CardItem[] = [
  {
    id: 'multitool',
    name: 'Мультитул МТ-4',
    category: 'tool',
    description: 'Инструмент инженера: кусачки, отвертка, сервисный щуп.',
    iconUrl: '/character/hero_standing.png' // or procedure/item icon
  },
  {
    id: 'tape',
    name: 'Изоляционная лента',
    category: 'consumable',
    description: 'Термостойкая диэлектрическая лента. Защищает от пробоя до 10 кВ.',
    iconUrl: '/items/item_energy_cell.png'
  },
  {
    id: 'keycard',
    name: 'Ключ-карта [07]',
    category: 'hardware',
    description: 'Магнитный пропуск уровня доступа А-1 к внешнему шлюзу.',
    iconUrl: '/items/item_keycard.png'
  },
  {
    id: 'stimpack',
    name: 'Стимпак H+',
    category: 'consumable',
    description: 'Инъектор био-регенератора: восстанавливает +40 HP.',
    iconUrl: '/items/item_stimpack.png'
  },
  {
    id: 'energy_cell',
    name: 'Энергоячейка',
    category: 'consumable',
    description: 'Компактный литий-ториевый блок питания (+50 энергии).',
    iconUrl: '/items/item_energy_cell.png'
  }
];
