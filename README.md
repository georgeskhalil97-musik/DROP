# DROP

Outil gratuit pour DJ : colle une playlist SoundCloud, récupère en un clic
toutes les tracks explicitement passées en "free download" par leurs artistes.

## Mise en ligne (une seule fois)

### 1. Mettre le code sur GitHub

Depuis ce dossier, dans un terminal :

```
git init
git add .
git commit -m "Premier commit DROP"
```

Puis va sur github.com, crée un nouveau repository (bouton "New"), nomme-le
"drop", et suis les commandes qu'il t'affiche pour "push an existing
repository" (copie-colle-les telles quelles dans ton terminal).

### 2. Connecter le repo à Vercel

1. Va sur vercel.com → "Add New" → "Project"
2. Choisis le repository GitHub "drop"
3. Vercel détecte automatiquement la configuration, ne change rien
4. **Avant de cliquer "Deploy"**, ouvre la section "Environment Variables" et ajoute :
   - `SOUNDCLOUD_CLIENT_ID` → ton Client ID SoundCloud
   - `SOUNDCLOUD_CLIENT_SECRET` → ton Client Secret SoundCloud
5. Clique "Deploy"

### 3. Mettre à jour l'app SoundCloud

Une fois le site en ligne, tu as une URL du type `drop-xxxx.vercel.app`.
Retourne sur developers.soundcloud.com → ton app "DROP" → remplace
`vercel.com` par ta vraie URL dans "Website of your app".

## Structure du projet

- `public/index.html` — l'interface (design déjà validé)
- `api/scan.js` — reçoit une URL de playlist, interroge SoundCloud, renvoie la liste des tracks
- `api/download.js` — génère le lien de téléchargement réel d'une track free download
- `api/_soundcloud.js` — logique partagée d'authentification (non exposée comme route)

## Limitations connues (V1)

- Les très grosses playlists (100+ tracks) ne sont pas encore paginées automatiquement
- Le bouton "Tout télécharger" ouvre les téléchargements un par un (pas de vrai .zip pour l'instant)
- Les tokens SoundCloud expirent après 6h ; le code les renouvelle automatiquement à chaque expiration
