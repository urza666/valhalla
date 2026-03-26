import { useState } from 'react';

const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Haeufig': ['👍', '❤️', '😂', '🎉', '🔥', '👀', '💯', '✅', '❌', '🤔', '😍', '🙌', '💀', '🫡', '👋', '🥳'],
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  'Gesten': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🙏', '💪'],
  'Herzen': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  'Objekte': ['⭐', '🌟', '✨', '💫', '🎵', '🎶', '🎯', '🎲', '🧩', '🎮', '🕹️', '🎪', '🎨', '🎭', '🏆', '🥇', '🥈', '🥉', '🏅', '📱', '💻', '🖥️', '⌨️', '🖱️', '💡', '🔋', '🔌'],
  'Symbole': ['✅', '❌', '❓', '❗', '‼️', '⁉️', '💤', '💢', '💬', '👁️‍🗨️', '🔔', '🔕', '📣', '📢', '🏳️', '🏴', '🚩', '⚡', '🔥', '💥', '💣', '🔰', '♻️', '⚠️', '🚫', '⛔'],
};

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Haeufig');

  const categories = Object.keys(EMOJI_CATEGORIES);
  const emojis = EMOJI_CATEGORIES[activeCategory] || [];

  return (
    <div className="emoji-picker-full" onClick={(e) => e.stopPropagation()}>
      {/* Search */}
      <div className="emoji-search">
        <input
          placeholder="Emoji suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Category tabs */}
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

      {/* Category label */}
      <div className="emoji-cat-label">{activeCategory}</div>

      {/* Emoji grid */}
      <div className="emoji-grid">
        {emojis
          .filter((e) => !search || e.includes(search))
          .map((emoji) => (
            <button
              key={emoji}
              className="emoji-btn"
              onClick={() => { onSelect(emoji); onClose(); }}
            >
              {emoji}
            </button>
          ))}
      </div>
    </div>
  );
}
