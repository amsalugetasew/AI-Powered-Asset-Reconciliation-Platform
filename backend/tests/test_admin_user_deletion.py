import os
import sys
import unittest

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from models import db, User, Reconciliation, AuditLog


class AdminUserDeletionTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app('default')
        self.app.config.update(TESTING=True)
        self.client = self.app.test_client()

        with self.app.app_context():
            db.drop_all()
            db.create_all()

            admin = User(username='adminuser', email='admin@example.com', role='admin')
            admin.set_password('secret123')
            db.session.add(admin)
            db.session.commit()

            target = User(username='deleteable', email='target@example.com', role='officer')
            target.set_password('secret456')
            db.session.add(target)
            db.session.commit()

            reconciliation = Reconciliation(
                user_id=target.id,
                customer_file='customer.xlsx',
                internal_file='internal.xlsx',
                status='completed'
            )
            db.session.add(reconciliation)
            db.session.add(AuditLog(user_id=target.id, operation_type='USER_LOGIN', resource_type='auth', details={}))
            db.session.commit()

    def test_admin_can_delete_user_with_related_data(self):
        with self.app.app_context():
            admin = User.query.filter_by(username='adminuser').first()
            admin_login = self.client.post('/api/auth/login', json={
                'username': 'adminuser',
                'password': 'secret123'
            })
            self.assertEqual(admin_login.status_code, 200)
            token = admin_login.get_json()['access_token']

            target = User.query.filter_by(username='deleteable').first()
            response = self.client.delete(
                f'/api/admin/users/{target.id}',
                headers={'Authorization': f'Bearer {token}'}
            )

            self.assertEqual(response.status_code, 200)
            self.assertIsNone(User.query.filter_by(id=target.id).first())
            self.assertEqual(Reconciliation.query.filter_by(user_id=target.id).count(), 0)

    def test_admin_can_deactivate_user(self):
        with self.app.app_context():
            admin = User.query.filter_by(username='adminuser').first()
            admin_login = self.client.post('/api/auth/login', json={
                'username': 'adminuser',
                'password': 'secret123'
            })
            self.assertEqual(admin_login.status_code, 200)
            token = admin_login.get_json()['access_token']

            target = User.query.filter_by(username='deleteable').first()
            response = self.client.put(
                f'/api/admin/users/{target.id}/deactivate',
                headers={'Authorization': f'Bearer {token}'}
            )

            self.assertEqual(response.status_code, 200)
            self.assertFalse(User.query.get(target.id).is_active)

    def test_admin_can_reset_user_password(self):
        with self.app.app_context():
            admin = User.query.filter_by(username='adminuser').first()
            admin_login = self.client.post('/api/auth/login', json={
                'username': 'adminuser',
                'password': 'secret123'
            })
            self.assertEqual(admin_login.status_code, 200)
            token = admin_login.get_json()['access_token']

            target = User.query.filter_by(username='deleteable').first()
            response = self.client.post(
                f'/api/admin/users/{target.id}/reset-password',
                headers={'Authorization': f'Bearer {token}'},
                json={'new_password': 'ResetPass123'}
            )

            self.assertEqual(response.status_code, 200)
            self.assertTrue(User.query.get(target.id).check_password('ResetPass123'))


if __name__ == '__main__':
    unittest.main()
