"""Admin: count or wipe registered-user data in Firestore. Usage: python admin_users.py count|wipe"""
import json, os, sys
import firebase_admin
from firebase_admin import credentials, firestore
firebase_admin.initialize_app(credentials.Certificate(json.loads(os.environ['FIREBASE_SA'])))
D = firestore.client()
COLS = ['users', 'tg_users', 'site_reg', 'tg_alerts']
mode = sys.argv[1] if len(sys.argv) > 1 else 'count'
for c in COLS:
    docs = list(D.collection(c).list_documents())
    print(f'{c}: {len(docs)}')
    if mode == 'wipe':
        for d in docs: d.delete()
        print(f'  deleted {len(docs)}')
