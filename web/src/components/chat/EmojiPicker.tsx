import { useState } from 'react';

// Emoji name mapping for search functionality
const EMOJI_NAMES: Record<string, string> = {
  '👍': 'thumbsup daumen hoch like', '❤️': 'herz heart liebe love', '😂': 'lachen laugh crying joy',
  '🎉': 'party feier tada celebration', '🔥': 'feuer fire hot', '👀': 'augen eyes schau look',
  '💯': 'hundert hundred perfect', '✅': 'check haken done erledigt', '❌': 'kreuz cross nein no',
  '🤔': 'denken thinking hmm nachdenken', '😍': 'herz augen love eyes verliebt',
  '🙌': 'hände hands yay praise', '💀': 'totenkopf skull dead tot', '🫡': 'salut salute',
  '👋': 'winken wave hallo hello', '🥳': 'party feier birthday geburtstag',
  '😀': 'grinsen grin happy', '😃': 'lachen smile happy', '😄': 'lachen grin happy',
  '😁': 'grinsen teeth zähne', '😆': 'lachen laugh happy squint', '😅': 'schwitz sweat lachen',
  '🤣': 'rofl lachen boden floor rolling', '😊': 'lächeln blush shy schüchtern',
  '😇': 'engel angel halo heilig', '🙂': 'lächeln slight smile', '😉': 'zwinkern wink',
  '😌': 'erleichtert relieved', '🥰': 'herzen hearts love verliebt',
  '😘': 'kuss kiss blow', '😗': 'kuss kiss', '😙': 'kuss kiss',
  '😚': 'kuss kiss blush', '😋': 'lecker yum tongue zunge',
  '😛': 'zunge tongue', '😜': 'zunge wink crazy verrückt',
  '🤪': 'verrückt crazy wild', '😝': 'zunge tongue squint',
  '🤑': 'geld money dollar reich', '🤗': 'umarmung hug umarmen',
  '🤭': 'kicher giggle oops', '🤫': 'still quiet shh psst',
  '🤐': 'mund zu zipper mouth', '🤨': 'skeptisch raised eyebrow',
  '😐': 'neutral blank', '😑': 'neutral blank expressionless',
  '😶': 'stumm mouthless ohne mund', '😏': 'grinsen smirk',
  '😒': 'genervt unamused annoyed', '🙄': 'augenrollen eye roll',
  '😬': 'grimasse grimacing', '😮': 'oh überrascht surprise',
  '😔': 'traurig sad pensive nachdenklich',
  '😪': 'müde sleepy tired', '🤤': 'sabbern drooling',
  '😴': 'schlafen sleep zzz', '😷': 'maske mask krank sick',
  '🤒': 'krank sick thermometer', '🤕': 'verletzt hurt bandage',
  '🤢': 'übel nausea sick', '🤮': 'kotzen vomit sick',
  '🥵': 'heiß hot schwitzen', '🥶': 'kalt cold freezing frieren',
  '🥴': 'benommen woozy drunk betrunken', '😵': 'schwindel dizzy',
  '🤯': 'explodiert mind blown kopf', '🤠': 'cowboy western',
  '🥸': 'verkleidung disguise', '😎': 'cool sonnenbrille sunglasses',
  '🤓': 'nerd brille glasses', '🧐': 'monokel monocle inspizieren',
  '✋': 'hand stop halt', '✌️': 'peace frieden victory sieg',
  '👊': 'faust fist bump', '✊': 'faust fist power kraft',
  '👏': 'klatschen clap applause', '🙏': 'beten pray bitte please danke thanks',
  '💪': 'stark strong muscle muskel bizeps', '⭐': 'stern star',
  '🌟': 'stern star glitzer sparkle', '✨': 'glitzer sparkle funken',
  '🎵': 'musik music note', '🎶': 'musik music notes noten',
  '🎯': 'ziel target bullseye', '🎲': 'würfel dice',
  '🎮': 'controller gaming spiel game', '🏆': 'pokal trophy gewinner winner',
  '📱': 'handy phone smartphone', '💻': 'laptop computer',
  '💡': 'idee idea glühbirne lightbulb', '🔔': 'glocke bell notification',
  '🔕': 'stumm mute bell glocke', '⚡': 'blitz lightning schnell fast',
  '💥': 'explosion boom crash', '🚩': 'flagge flag red redflag',
  '🌞': 'sonne sun', '🌙': 'mond moon nacht', '🌈': 'regenbogen rainbow',
  '🌊': 'welle wave meer ocean', '🌸': 'kirschblüte blossom', '🌹': 'rose',
  '🐶': 'hund dog', '🐱': 'katze cat', '🐻': 'bär bear', '🦊': 'fuchs fox',
  '🦁': 'löwe lion', '🐸': 'frosch frog', '🦋': 'schmetterling butterfly',
  '🍕': 'pizza', '🍔': 'burger hamburger', '🍺': 'bier beer', '☕': 'kaffee coffee',
  '🎂': 'kuchen cake geburtstag', '🥂': 'prost cheers sekt', '⚽': 'fussball soccer',
  '🇩🇪': 'deutschland germany', '🇪🇺': 'europa europe eu',
};

const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Häufig': ['👍', '❤️', '😂', '🎉', '🔥', '👀', '💯', '✅', '❌', '🤔', '😍', '🙌', '💀', '🫡', '👋', '🥳'],
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  'Gesten': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🙏', '💪'],
  'Herzen': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  'Natur': ['🌞', '🌙', '⭐', '🌟', '✨', '☁️', '🌈', '🌧️', '⛈️', '❄️', '🌊', '🌸', '🌺', '🌻', '🌹', '🌷', '🌱', '🌲', '🌳', '🍀', '🍁', '🍂', '🍃', '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦅', '🦆', '🦉', '🐝', '🐛', '🦋', '🐌', '🐞', '🐙', '🦀', '🐠', '🐬', '🐳', '🦈'],
  'Essen': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥝', '🍅', '🥑', '🌽', '🥕', '🧄', '🧅', '🥦', '🍔', '🍟', '🍕', '🌮', '🌯', '🥗', '🍜', '🍝', '🍣', '🍱', '🥟', '🍩', '🍪', '🎂', '🍰', '🧁', '🍫', '🍬', '🍭', '🍦', '☕', '🍵', '🥤', '🍺', '🍷', '🥂', '🍾'],
  'Reisen': ['🚗', '🚕', '🚌', '🏎️', '🚑', '🚒', '✈️', '🚀', '🛸', '🚢', '🏠', '🏢', '🏰', '🗼', '🗽', '⛪', '🕌', '🏔️', '🌋', '🏖️', '🏕️', '🎡', '🎢', '🎠'],
  'Sport': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🥊', '🥋', '⛷️', '🏂', '🏋️', '🤸', '🚴', '🏊', '🧗', '🏄', '🤽', '🎿', '🏇'],
  'Objekte': ['⭐', '🌟', '✨', '💫', '🎵', '🎶', '🎯', '🎲', '🧩', '🎮', '🕹️', '🎪', '🎨', '🎭', '🏆', '🥇', '🥈', '🥉', '🏅', '📱', '💻', '🖥️', '⌨️', '🖱️', '💡', '🔋', '🔌', '📷', '📹', '📺', '📻', '⏰', '🔑', '🗝️', '🔒', '📦', '📫', '📝', '📊', '📈', '📉', '🗂️', '📁', '✂️', '📌', '📎', '🖊️', '✏️'],
  'Symbole': ['✅', '❌', '❓', '❗', '‼️', '⁉️', '💤', '💢', '💬', '👁️‍🗨️', '🔔', '🔕', '📣', '📢', '🏳️', '🏴', '🚩', '⚡', '🔥', '💥', '💣', '🔰', '♻️', '⚠️', '🚫', '⛔', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '▪️', '▫️', '💠', '🔲', '🔳'],
  'Flaggen': ['🇩🇪', '🇦🇹', '🇨🇭', '🇺🇸', '🇬🇧', '🇫🇷', '🇪🇸', '🇮🇹', '🇯🇵', '🇰🇷', '🇨🇳', '🇷🇺', '🇧🇷', '🇮🇳', '🇦🇺', '🇨🇦', '🇲🇽', '🇹🇷', '🇵🇱', '🇳🇱', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇵🇹', '🇬🇷', '🇺🇦', '🇪🇺'],
};

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Häufig');

  const categories = Object.keys(EMOJI_CATEGORIES);

  // Search across all categories by name
  const getFilteredEmojis = (): string[] => {
    if (!search) return EMOJI_CATEGORIES[activeCategory] || [];

    const q = search.toLowerCase();
    const results: string[] = [];
    const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
    const seen = new Set<string>();

    for (const emoji of allEmojis) {
      if (seen.has(emoji)) continue;
      seen.add(emoji);

      // Search by emoji name keywords
      const names = EMOJI_NAMES[emoji] || '';
      if (names.includes(q) || emoji.includes(search)) {
        results.push(emoji);
      }
    }
    return results;
  };

  const filteredEmojis = getFilteredEmojis();

  return (
    <div className="emoji-picker-full" onClick={(e) => e.stopPropagation()}>
      {/* Search */}
      <div className="emoji-search">
        <input
          placeholder="Emoji suchen... (z.B. lachen, herz, feuer)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Category tabs — hide when searching */}
      {!search && (
        <div className="emoji-categories">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`emoji-cat-btn ${cat === activeCategory ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
              title={cat}
            >
              {EMOJI_CATEGORIES[cat][0]}
            </button>
          ))}
        </div>
      )}

      {/* Category label */}
      <div className="emoji-cat-label">
        {search ? `Suche: "${search}" (${filteredEmojis.length} Ergebnisse)` : activeCategory}
      </div>

      {/* Emoji grid */}
      <div className="emoji-grid">
        {filteredEmojis.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 16, color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
            Kein Emoji gefunden
          </div>
        ) : (
          filteredEmojis.map((emoji, idx) => (
            <button
              key={emoji + idx}
              className="emoji-btn"
              onClick={() => { onSelect(emoji); onClose(); }}
              title={EMOJI_NAMES[emoji]?.split(' ')[0] || emoji}
            >
              {emoji}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
