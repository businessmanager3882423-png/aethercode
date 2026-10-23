
# AetherCode Digital Solutions

Responsive digital agency website and Firebase client workspace.

## Stack

- HTML, CSS and JavaScript modules
- Firebase Authentication
- Cloud Firestore
- GitHub
- Vercel

## Setup

1. Create a Firebase project and register a Web App.
2. Enable Email/Password and Google providers in Firebase Authentication.
3. Add your deployed domain to Firebase Authentication authorized domains.
4. Paste your Firebase Web App configuration into `js/firebase.js`.
5. Create the Firestore database.
6. Publish `firestore.rules` and `firestore.indexes.json`.
7. Create an initial trusted owner access document using the Firebase Console.
8. Deploy the project through GitHub and Vercel.
9. Test with separate owner and client accounts.

## Initial owner bootstrap

After creating the Firestore database, use the Firebase Console to create:

Collection: `settings`

Document: `ownerAccess`

Field:
- `ownerUids`: array containing the trusted owner's Firebase Authentication UID.

Do not put client UIDs in this array. Never let a public signup form assign owner privileges.

## Security

Firestore rules are essential. UI visibility is not authorization.
Keep payment verification, invoice numbering, staff role changes and other
sensitive actions on a trusted backend when implementing those features.

## Images

Use HTTPS image URLs from a provider you control. This project does not require
Firebase Storage.

## Deployment

Import the GitHub repository into Vercel and deploy the project root.
