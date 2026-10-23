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
  { id: 'chips', name: 'Potato chips', jp: 'ポテトチップス', icon: '🥔', price: 140, use: 'You ate the chips. Crunchy, salty.', note: 'Consomme flavour.' },
  { id: 'chocolate', name: 'Chocolate', jp: 'チョコ', icon: '🍫', price: 120, use: 'You ate the chocolate. Mmm.', note: 'Milk chocolate bar.' },
  { id: 'candy', name: 'Candy', jp: 'キャンディ', icon: '🍬', price: 100, use: 'You ate the candy. Sweet and sour.', note: 'A bag of fruit candy.' },
  { id: 'noodles', name: 'Cup noodles', jp: 'カップ麺', icon: '🍜', price: 230, use: 'You ate the noodles. Three minutes well spent.', note: 'Shoyu ramen. Hot water is by the counter.' },
  { id: 'sandwich', name: 'Sandwich', jp: 'サンドイッチ', icon: '🥪', price: 280, use: 'You ate the sandwich. Egg salad!', note: 'Egg salad, crusts off.' },
  { id: 'salad', name: 'Salad', jp: 'サラダ', icon: '🥗', price: 320, use: 'You ate the salad. Fresh.', note: 'Chicken and greens.' },
  { id: 'soda', name: 'Soda', jp: 'ソーダ', icon: '🥤', price: 150, use: 'You drank the soda. Fizzy!', note: 'Lemon soda in a bottle.' },
  { id: 'milk', name: 'Milk', jp: '牛乳', icon: '🥛', price: 130, use: 'You drank the milk. Good for the bones.', note: 'A small carton.' },
  { id: 'juice', name: 'Juice', jp: 'ジュース', icon: '🧃', price: 140, use: 'You drank the juice. Orange!', note: 'A box of orange juice.' },
  { id: 'shaved', name: 'Shaved ice', jp: 'かき氷', icon: '🍧', price: 150, use: 'You ate the shaved ice. Brain freeze!', note: 'Strawberry syrup.' },
  { id: 'pen', name: 'Pen', jp: 'ペン', icon: '✏️', price: 100, note: 'A plain black pen.' },
  { id: 'tissue', name: 'Tissues', jp: 'ティッシュ', icon: '🧻', price: 150, note: 'A pack of pocket tissues.' },
  { id: 'battery', name: 'Batteries', jp: '電池', icon: '🔋', price: 350, note: 'Four AA batteries.' },
  { id: 'mask', name: 'Face masks', jp: 'マスク', icon: '😷', price: 200, note: 'A pack of paper masks.' },
  { id: 'magazine', name: 'Magazine', jp: '雑誌', icon: '📖', price: 480, note: 'This month\'s Hoshi Town guide.' },
  { id: 'newspaper', name: 'Newspaper', jp: '新聞', icon: '📰', price: 150, note: 'Today\'s paper.' },
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

/** What each part of the shop sells (the shelves hold different things). */
export interface ShelfDef { id: string; name: string; jp: string; icon: string; items: string[] }
export const SHELVES: ShelfDef[] = [
  { id: 'snacks', name: 'Snacks and bread', jp: 'お菓子・パン', icon: '🍞', items: ['bread', 'chips', 'chocolate', 'candy', 'noodles'] },
  { id: 'daily', name: 'Daily goods', jp: '日用品', icon: '🧻', items: ['notebook', 'pen', 'tissue', 'battery', 'mask', 'umbrella'] },
  { id: 'drinks', name: 'Drinks cooler', jp: 'ドリンク', icon: '🥤', items: ['coffee', 'tea', 'soda', 'milk', 'juice'] },
  { id: 'fresh', name: 'Fresh food', jp: '弁当・おにぎり', icon: '🍱', items: ['onigiri', 'bento', 'sandwich', 'salad'] },
  { id: 'frozen', name: 'Freezer', jp: '冷凍・アイス', icon: '🍦', items: ['icecream', 'shaved'] },
  { id: 'magazines', name: 'Magazines', jp: '雑誌', icon: '📖', items: ['magazine', 'newspaper'] },
];
export const shelfOf = (id: string): ShelfDef => SHELVES.find((s) => s.id === id) ?? SHELVES[0];
/** How many things the basket holds. */
export const BASKET_CAP = 12;
