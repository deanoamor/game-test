/** What can be carried, and the bags that carry it. */

export interface ItemDef {
  id: string;
  name: string;
  jp: string;
  icon: string;
  /** Yen, in the shop (0: not for sale). */
  price: number;
  /** What using it does (none: it is only kept). */
  use?: string;
  note: string;
}

export const ITEMS: ItemDef[] = [
  { id: 'onigiri', name: 'Onigiri', jp: 'おにぎり', icon: '🍙', price: 150, use: 'You ate the onigiri. Salmon, the best kind!', note: 'A rice ball with salmon.' },
  { id: 'bento', name: 'Bento', jp: 'お弁当', icon: '🍱', price: 450, use: 'You ate the bento. Warm and filling.', note: 'A lunch box: rice, fried chicken, pickles.' },
  { id: 'coffee', name: 'Canned coffee', jp: '缶コーヒー', icon: '☕', price: 130, use: 'You drank the canned coffee. Ahh!', note: 'Sweet, hot, from the shop.' },
  { id: 'tea', name: 'Green tea', jp: 'お茶', icon: '🍵', price: 140, use: 'You drank the green tea. So calm.', note: 'A bottle of cold green tea.' },
  { id: 'bread', name: 'Cream bread', jp: 'クリームパン', icon: '🍞', price: 160, use: 'You ate the cream bread. Sweet!', note: 'It sells out before noon.' },
  { id: 'icecream', name: 'Ice cream', jp: 'アイス', icon: '🍦', price: 180, use: 'You ate the ice cream. Cold!', note: 'Vanilla, on a stick.' },
  { id: 'umbrella', name: 'Umbrella', jp: '傘', icon: '☂️', price: 600, note: 'A clear plastic umbrella. For the rain, someday.' },
  { id: 'notebook', name: 'Notebook', jp: 'ノート', icon: '📓', price: 220, note: 'For notes about the town.' },
  { id: 'keys', name: 'House keys', jp: '家の鍵', icon: '🔑', price: 0, note: 'The keys to the flat at the top of the stairs.' },
];
export const itemOf = (id: string): ItemDef => ITEMS.find((i) => i.id === id) ?? ITEMS[0];
export const MAX_STACK = 5;

export interface BagDef {
  id: string;
  name: string;
  jp: string;
  icon: string;
  slots: number;
  note: string;
}
export const BAGS: BagDef[] = [
  { id: 'tote', name: 'Tote bag', jp: 'トートバッグ', icon: '👜', slots: 6, note: 'Light and small. Hangs from her hand.' },
  { id: 'shoulder', name: 'Shoulder bag', jp: 'ショルダーバッグ', icon: '👝', slots: 8, note: 'Worn across the body.' },
  { id: 'school', name: 'School bag', jp: '学生かばん', icon: '🎒', slots: 10, note: 'Her everyday bag for school.' },
  { id: 'backpack', name: 'Hiking backpack', jp: 'リュック', icon: '🧳', slots: 16, note: 'Big. Room for a whole day out.' },
];
export const bagOf = (id: string): BagDef => BAGS.find((b) => b.id === id) ?? BAGS[2];
