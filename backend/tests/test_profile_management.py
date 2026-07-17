import os
import sys
import unittest
from unittest.mock import patch

from sqlalchemy.exc import IntegrityError

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from models import db


class ProfileManagementTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app('default')
        self.app.config.update(TESTING=True)
        self.client = self.app.test_client()

        with self.app.app_context():
            db.drop_all()
            db.create_all()

    def test_profile_and_password_update_flow(self):
        register_resp = self.client.post('/api/auth/register', json={
            'username': 'profileuser',
            'email': 'profile@example.com',
            'password': 'secret123'
        })
        self.assertEqual(register_resp.status_code, 201)

        token = register_resp.get_json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        profile_resp = self.client.put('/api/auth/profile', headers=headers, json={
            'username': 'updateduser',
            'email': 'updated@example.com',
            'profile_picture': 'data:image/png;base64,abc123'
        })
        self.assertEqual(profile_resp.status_code, 200)
        self.assertEqual(profile_resp.get_json()['user']['username'], 'updateduser')
        self.assertEqual(profile_resp.get_json()['user']['profile_picture'], 'data:image/png;base64,abc123')

        password_resp = self.client.post('/api/auth/change-password', headers=headers, json={
            'current_password': 'secret123',
            'new_password': 'newsecret456'
        })
        self.assertEqual(password_resp.status_code, 200)

    def test_profile_update_returns_client_error_on_integrity_error(self):
        register_resp = self.client.post('/api/auth/register', json={
            'username': 'profileuser2',
            'email': 'profile2@example.com',
            'password': 'secret123'
        })
        self.assertEqual(register_resp.status_code, 201)

        token = register_resp.get_json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        with patch('routes.auth_routes.db.session.commit', side_effect=IntegrityError('stmt', {}, Exception('boom'))):
            profile_resp = self.client.put('/api/auth/profile', headers=headers, json={
                'username': 'updateduser2',
                'email': 'updated2@example.com'
            })

        self.assertEqual(profile_resp.status_code, 400)
        self.assertIn('Profile update failed', profile_resp.get_json()['error'])


if __name__ == '__main__':
    unittest.main()
