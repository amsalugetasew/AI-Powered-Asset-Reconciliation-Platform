import io
import os
import json

import pandas as pd

from app import create_app
from models import db, User, Reconciliation, ReconciliationRecord
from routes.reconciliation_routes import _auto_save_records


def _make_user(username, email, role='officer'):
    user = User(
        username=username,
        email=email,
        full_name=username,
        password_hash='hashed-password',
        role=role,
        is_active=True,
        status='active'
    )
    db.session.add(user)
    db.session.commit()
    return user


def test_auto_save_records_persists_report_rows(tmp_path):
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
    app = create_app('development')
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

    with app.app_context():
        db.drop_all()
        db.create_all()

        user = _make_user('report_owner', 'owner@example.com', 'officer')
        user.set_password('Password123!')
        db.session.commit()

        reconciliation = Reconciliation(
            user_id=user.id,
            customer_file='customer.xlsx',
            internal_file='internal.xlsx',
            status='completed'
        )
        db.session.add(reconciliation)
        db.session.commit()

        report_path = tmp_path / 'reconciliation_report.xlsx'
        with pd.ExcelWriter(report_path) as writer:
            pd.DataFrame([
                {'Old Tag': 'A1', 'New Tag': 'A1', 'Description': 'Matched record'}
            ]).to_excel(writer, sheet_name='Exact_Matched_By_Tag', index=False)

        saved_count = _auto_save_records(reconciliation.id, str(report_path))
        assert saved_count == 1
        assert ReconciliationRecord.query.filter_by(reconciliation_id=reconciliation.id).count() == 1


def test_checker_and_approver_status_columns_are_persisted():
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
    app = create_app('development')
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

    with app.app_context():
        db.drop_all()
        db.create_all()

        officer_one = _make_user('officer_one', 'officer1@example.com', 'officer')
        officer_two = _make_user('officer_two', 'officer2@example.com', 'officer')
        manager = _make_user('manager_user', 'manager@example.com', 'manager')

        recon = Reconciliation(
            user_id=officer_one.id,
            customer_file='one.xlsx',
            internal_file='two.xlsx',
            status='completed',
            total_customer_records=10,
            total_internal_records=10,
            rule_matched=5,
            ai_matched=5,
            manual_review=0,
        )
        db.session.add(recon)
        db.session.commit()

        record = ReconciliationRecord(
            reconciliation_id=recon.id,
            match_category='Exact Match',
            full_record_json={'customer_old_tag': 'A1', 'internal_old_tag': 'A1'},
            check_status='pending',
            approval_status='pending',
            checker_status='pending',
            approver_status='pending',
        )
        db.session.add(record)
        db.session.commit()

        officer_two.set_password('Password123!')
        manager.set_password('Password123!')
        db.session.commit()

        client = app.test_client()
        login_two = client.post('/api/auth/login', json={'username': 'officer_two', 'password': 'Password123!'})
        token_two = login_two.get_json()['access_token']

        check_response = client.post(
            '/api/reconciliation/records/approve-record',
            json={'record_id': record.id, 'approval_decision': 'reconciled', 'decision_stage': 'check'},
            headers={'Authorization': f'Bearer {token_two}'}
        )
        assert check_response.status_code == 200, check_response.get_data(as_text=True)
        db.session.refresh(record)
        assert record.checker_status == 'reconciled'
        assert record.check_status == 'reconciled'

        login_manager = client.post('/api/auth/login', json={'username': 'manager_user', 'password': 'Password123!'})
        manager_token = login_manager.get_json()['access_token']

        approve_response = client.post(
            '/api/reconciliation/records/approve-record',
            json={'record_id': record.id, 'approval_decision': 'reconciled', 'decision_stage': 'approve'},
            headers={'Authorization': f'Bearer {manager_token}'}
        )
        assert approve_response.status_code == 200, approve_response.get_data(as_text=True)
        db.session.refresh(record)
        assert record.approver_status == 'reconciled'
        assert record.approval_status == 'reconciled'


def test_bulk_approve_is_scoped_to_selected_category(tmp_path):
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
    app = create_app('development')
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

    with app.app_context():
        db.drop_all()
        db.create_all()

        officer = _make_user('officer_one', 'officer1@example.com', 'officer')
        manager = _make_user('manager_user', 'manager@example.com', 'manager')
        officer.set_password('Password123!')
        manager.set_password('Password123!')
        db.session.commit()

        reconciliation = Reconciliation(
            user_id=officer.id,
            customer_file='customer.xlsx',
            internal_file='internal.xlsx',
            status='completed',
            total_customer_records=2,
            total_internal_records=2,
            report_path=str(tmp_path / 'report.xlsx')
        )
        db.session.add(reconciliation)
        db.session.commit()

        with pd.ExcelWriter(reconciliation.report_path) as writer:
            pd.DataFrame([{'Old Tag': 'A1', 'New Tag': 'A1'}]).to_excel(writer, sheet_name='Exact_Matched_By_Tag', index=False)
            pd.DataFrame([{'Old Tag': 'B1', 'New Tag': 'B1'}]).to_excel(writer, sheet_name='AI_Matched_Need_Manual_Review', index=False)

        checked_record = ReconciliationRecord(
            reconciliation_id=reconciliation.id,
            match_category='Exact Match',
            check_status='reconciled',
            checker_status='reconciled',
            approval_status='pending',
            approver_status='pending',
        )
        pending_record = ReconciliationRecord(
            reconciliation_id=reconciliation.id,
            match_category='AI Match',
            check_status='pending',
            checker_status='pending',
            approval_status='pending',
            approver_status='pending',
        )
        db.session.add_all([checked_record, pending_record])
        db.session.commit()

        client = app.test_client()
        login_manager = client.post('/api/auth/login', json={'username': 'manager_user', 'password': 'Password123!'})
        token = login_manager.get_json()['access_token']

        response = client.post(
            '/api/reconciliation/records/approve-group',
            json={
                'reconciliation_id': reconciliation.id,
                'category': 'Exact Match',
                'approval_decision': 'reconciled',
                'decision_stage': 'approve'
            },
            headers={'Authorization': f'Bearer {token}'}
        )

        assert response.status_code == 200, response.get_data(as_text=True)
        payload = response.get_json()
        assert payload['decision_stage'] == 'approver'
        assert payload['records_updated'] == 1


def test_download_enriched_report_keeps_missing_checker_approver_blank(tmp_path):
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
    app = create_app('development')
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

    with app.app_context():
        db.drop_all()
        db.create_all()

        maker = _make_user('maker_user', 'maker@example.com', 'officer')
        checker = _make_user('checker_user', 'checker@example.com', 'officer')
        approver = _make_user('approver_user', 'approver@example.com', 'manager')
        maker.set_password('Password123!')
        checker.set_password('Password123!')
        approver.set_password('Password123!')
        db.session.commit()

        reconciliation = Reconciliation(
            user_id=maker.id,
            customer_file='customer.xlsx',
            internal_file='internal.xlsx',
            status='completed',
            report_path=str(tmp_path / 'report.xlsx')
        )
        db.session.add(reconciliation)
        db.session.commit()

        with pd.ExcelWriter(reconciliation.report_path) as writer:
            pd.DataFrame([
                {'Old Tag': 'A1', 'New Tag': 'A1', 'Description': 'Matched record'}
            ]).to_excel(writer, sheet_name='Exact_Matched_By_Tag', index=False)

        record = ReconciliationRecord(
            reconciliation_id=reconciliation.id,
            match_category='Exact Match',
            maker_user_id=maker.id,
            checked_by=checker.id,
            approved_by=approver.id,
            full_record_json={'customer_old_tag': 'A1', 'internal_old_tag': 'A1'},
            check_status='reconciled',
            checker_status='reconciled',
            approval_status='reconciled',
            approver_status='reconciled',
        )
        db.session.add(record)
        db.session.commit()

        client = app.test_client()
        login = client.post('/api/auth/login', json={'username': 'maker_user', 'password': 'Password123!'})
        token = login.get_json()['access_token']

        response = client.get(
            f'/api/reconciliation/download-enriched/{reconciliation.id}',
            headers={'Authorization': f'Bearer {token}'}
        )
        assert response.status_code == 200, response.get_data(as_text=True)

        sheet = pd.read_excel(io.BytesIO(response.data), sheet_name='Exact_Matched_By_Tag')
        assert 'Maker' in sheet.columns
        assert 'Checker' in sheet.columns
        assert 'Approver' in sheet.columns
        assert 'Checker Status' in sheet.columns
        assert 'Approver Status' in sheet.columns
        assert 'Approval Status' in sheet.columns

        row = sheet.iloc[0]
        assert row['Maker'] == 'maker_user'
        assert row['Checker'] == 'checker_user'
        assert row['Approver'] == 'approver_user'
        assert str(row['Checker Status']).strip() == 'Reconciled'
        assert str(row['Approver Status']).strip() == 'Reconciled'
        assert str(row['Approval Status']).strip() == 'Reconciled'

        blank_record = ReconciliationRecord(
            reconciliation_id=reconciliation.id,
            match_category='AI Match',
            maker_user_id=maker.id,
            full_record_json={'customer_old_tag': 'B1', 'internal_old_tag': 'B1'},
            check_status='pending',
            checker_status='pending',
            approval_status='pending',
            approver_status='pending',
        )
        db.session.add(blank_record)
        db.session.commit()

        response = client.get(
            f'/api/reconciliation/download-enriched/{reconciliation.id}',
            headers={'Authorization': f'Bearer {token}'}
        )
        assert response.status_code == 200, response.get_data(as_text=True)

        blank_sheet = pd.read_excel(io.BytesIO(response.data), sheet_name='AI_Matched_Need_Manual_Review')
        assert 'Maker' in blank_sheet.columns
        assert 'Checker' in blank_sheet.columns
        assert 'Approver' in blank_sheet.columns
        assert str(blank_sheet.iloc[0]['Checker']).strip() == ''
        assert str(blank_sheet.iloc[0]['Approver']).strip() == ''
        assert str(blank_sheet.iloc[0]['Checker Status']).strip() == ''
        assert str(blank_sheet.iloc[0]['Approver Status']).strip() == ''
        assert str(blank_sheet.iloc[0]['Approval Status']).strip() == ''


def test_assignment_and_assignee_approval_flow():
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
    app = create_app('development')
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

    with app.app_context():
        db.drop_all()
        db.create_all()

        officer_one = _make_user('officer_one', 'officer1@example.com', 'officer')
        officer_two = _make_user('officer_two', 'officer2@example.com', 'officer')
        manager = _make_user('manager_user', 'manager@example.com', 'manager')

        recon = Reconciliation(
            user_id=officer_one.id,
            customer_file='one.xlsx',
            internal_file='two.xlsx',
            status='completed',
            total_customer_records=10,
            total_internal_records=10,
            rule_matched=5,
            ai_matched=5,
            manual_review=0,
        )
        db.session.add(recon)
        db.session.commit()

        client = app.test_client()

        # Login as officer_one to assign the report to officer_two
        login_res = client.post('/api/auth/login', json={'username': 'officer_one', 'password': 'wrong-password'})
        assert login_res.status_code == 401

        # create real password hashes for login using user.set_password
        officer_one.set_password('Password123!')
        officer_two.set_password('Password123!')
        manager.set_password('Password123!')
        db.session.commit()

        login_res = client.post('/api/auth/login', json={'username': 'officer_one', 'password': 'Password123!'})
        assert login_res.status_code == 200, login_res.get_data(as_text=True)
        token = login_res.get_json()['access_token']

        assign_res = client.post(
            f'/api/reconciliation/{recon.id}/assign',
            json={
                'assignment_scope': 'specific_user',
                'assignee_id': officer_two.id,
                'assignment_note': 'Please verify the mismatch'
            },
            headers={'Authorization': f'Bearer {token}'}
        )
        assert assign_res.status_code == 200, assign_res.get_data(as_text=True)
        payload = assign_res.get_json()
        assert payload['assignment']['assigned_to'] == officer_two.id
        assert payload['assignment']['assignment_scope'] == 'specific_user'

        # Officer two should be able to review the assigned records using approval endpoints
        login_two = client.post('/api/auth/login', json={'username': 'officer_two', 'password': 'Password123!'})
        token_two = login_two.get_json()['access_token']

        records = client.get(f'/api/reconciliation/records/{recon.id}', headers={'Authorization': f'Bearer {token_two}'})
        assert records.status_code == 200, records.get_data(as_text=True)

        assert records.get_json()['records'] == []

        # Manager access should still work
        login_manager = client.post('/api/auth/login', json={'username': 'manager_user', 'password': 'Password123!'})
        manager_token = login_manager.get_json()['access_token']
        users = client.get('/api/reconciliation/assignable-users', headers={'Authorization': f'Bearer {manager_token}'})
        assert users.status_code == 200, users.get_data(as_text=True)
        assert any(user['username'] == 'officer_two' for user in users.get_json()['users'])

        # Checker before approver: officer can set a review decision, then manager can approve
        record = ReconciliationRecord(
            reconciliation_id=recon.id,
            match_category='Exact Match',
            full_record_json={'customer_old_tag': 'A1', 'internal_old_tag': 'A1'},
            check_status='pending',
            approval_status='pending'
        )
        db.session.add(record)
        db.session.commit()

        check_response = client.post(
            '/api/reconciliation/records/approve-record',
            json={'record_id': record.id, 'approval_decision': 'reconciled', 'decision_stage': 'check'},
            headers={'Authorization': f'Bearer {token_two}'}
        )
        assert check_response.status_code == 200, check_response.get_data(as_text=True)
        check_payload = check_response.get_json()
        assert check_payload['decision_stage'] == 'checker'
        assert record.check_status == 'reconciled'

        approve_response = client.post(
            '/api/reconciliation/records/approve-record',
            json={'record_id': record.id, 'approval_decision': 'reconciled', 'decision_stage': 'approve'},
            headers={'Authorization': f'Bearer {manager_token}'}
        )
        assert approve_response.status_code == 200, approve_response.get_data(as_text=True)
        approve_payload = approve_response.get_json()
        assert approve_payload['decision_stage'] == 'approver'
        assert record.approval_status == 'reconciled'

        records_response = client.get(
            f'/api/reconciliation/records/{recon.id}',
            headers={'Authorization': f'Bearer {manager_token}'}
        )
        assert records_response.status_code == 200, records_response.get_data(as_text=True)
        response_records = records_response.get_json()['records']
        assert len(response_records) >= 1
        first_record = next(item for item in response_records if item['id'] == record.id)
        assert first_record['maker_username'] == 'officer_one'
        assert first_record['checked_by_username'] == 'officer_two'
        assert first_record['approved_by_username'] == 'manager_user'
