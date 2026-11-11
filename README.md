# Plan carnet

Work on a long note like a notebook: as a collapsible tree of sections that you can reorder, rename and annotate, while everything stays in a single Markdown file.

*Version française plus bas.*

![Plan carnet](./images/screenshot.png)

## Why

Long documents (a novel, a dictionary, a thesis, a course) quickly become hard to navigate in one file. Splitting them into dozens of notes solves that, but you lose the ability to read and export the whole text at once. Plan carnet keeps one file per project and gives you a notebook-style outline on top of it. Your headings are the structure: nothing is stored outside your note.

## Features

- **Outline tree** of the current note's headings (H1 to H6) in the sidebar, collapsible and in sync with the editor.
- **Reorder sections by drag and drop**: a section always moves with its text and all its subsections.
- **Section menu**: move up or down, indent or outdent, change level, rename, copy, add a subsection or a section after, delete (with a restore command).
- **Separate notes panel**: subsections titled "Notes", "See also" or any title you choose are shown in a side panel next to the text, and can be hidden from the main text.
- **Statuses** per section (idea, draft, to review, done) and word counts in the notes index.
- **Quick capture**: jot an idea into any section without leaving the note you are in.
- **Links**: type a shortcut (`@@` by default) to link to a section or a note, or insert a web link.
- **Heading appearance**: size, color, style and decoration for each level, with an optional indentation of each level and its text.
- **Keyboard commands** to raise or lower a heading, turn a line into a heading of a given level, and move the section under the cursor.

## Usage

1. Open a note and click the tree icon in the ribbon, or run the command **Ouvrir le plan**.
2. Drag sections in the tree to reorder them. Right-click a section for all actions.
3. Open the notes panel with the sticky-note icon.
4. Settings let you choose the sidebar, the note titles, the link shortcut and the appearance of each level.

## Language

The interface is currently in French. An English translation is planned. Contributions are welcome.

## Compatibility

Tested on desktop and Android. iOS feedback is welcome.

## Installation

From Obsidian: **Settings → Community plugins → Browse**, search for "Plan carnet", then install and enable.

Manual: download `main.js`, `manifest.json` and `styles.css` from the latest release into `<your vault>/.obsidian/plugins/plan-carnet/`, then enable the plugin.

## License

MIT

---

# Plan carnet (français)

Travaille une longue note comme un carnet : un plan de sections repliable, que tu réorganises, renommes et annotes, sans jamais quitter un seul et même fichier Markdown.

## Pourquoi

Un roman, un dictionnaire, un mémoire ou un cours deviennent vite difficiles à parcourir dans un seul fichier. Les éclater en dizaines de notes règle le problème, mais tu perds la vue d'ensemble et l'export du texte complet. Plan carnet garde un fichier par projet et lui ajoute un plan façon carnet. Tes titres sont la structure. Rien n'est stocké ailleurs que dans ta note.

## Fonctions

- **Arbre des titres** de la note ouverte (niveaux 1 à 6) dans la barre latérale, repliable et synchronisé avec l'éditeur.
- **Réorganisation par glisser-déposer** : une section emporte toujours son texte et ses sous-sections.
- **Menu de section** : monter, descendre, ranger dans la section au-dessus ou en sortir, changer de niveau, renommer, copier, ajouter une sous-section ou une section après, supprimer (avec une commande de restauration).
- **Notes séparées du texte** : les sous-sections intitulées « Notes », « Voir aussi » ou tout titre de ton choix s'affichent dans un panneau à côté du texte et peuvent être masquées dans la note.
- **Statuts** par section (idée, brouillon, à relire, fini) et nombre de mots dans l'index des notes.
- **Prise de note rapide** : glisse une idée dans n'importe quelle section sans quitter la note où tu es.
- **Liens** : tape un raccourci (`@@` par défaut) pour lier une section ou une note, ou insère un lien web.
- **Apparence des niveaux** : taille, couleur, style et décoration pour chaque niveau, avec un décalage du texte selon le niveau.
- **Commandes clavier** pour monter ou descendre un titre d'un niveau, transformer une ligne en titre et déplacer la section où se trouve le curseur.

## Utilisation

1. Ouvre une note et clique sur l'icône en arbre dans le ruban, ou lance la commande **Ouvrir le plan**.
2. Fais glisser les sections dans l'arbre pour les réordonner. Un clic droit sur une section donne toutes les actions.
3. Ouvre le panneau des notes avec l'icône en forme de pense-bête.
4. Les réglages permettent de choisir la barre latérale, les titres traités comme notes, le raccourci de lien et l'apparence de chaque niveau.

## Compatibilité

Testé sur ordinateur et Android. Retours iOS bienvenus.

## Auteur

Daniel Pigeon-Angelini (DPA)
