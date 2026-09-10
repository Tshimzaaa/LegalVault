from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.intake.models import IntakeForm, IntakeFormField, IntakeSubmission, IntakeSubmissionAnswer


class IntakeRepository:

    def __init__(self, db: Session):
        self.db = db

    # Forms

    def create_form(self, form: IntakeForm) -> IntakeForm:
        self.db.add(form)
        self.db.flush()
        return form

    def get_form_by_id(self, form_id) -> IntakeForm | None:
        return self.db.scalar(
            select(IntakeForm).where(IntakeForm.id == form_id).options(selectinload(IntakeForm.fields))
        )

    def list_forms_by_ids(self, form_ids) -> list[IntakeForm]:
        if not form_ids:
            return []
        return list(
            self.db.scalars(
                select(IntakeForm).where(IntakeForm.id.in_(form_ids)).options(selectinload(IntakeForm.fields))
            )
        )

    def list_forms_by_firm(self, firm_id) -> list[IntakeForm]:
        return list(
            self.db.scalars(
                select(IntakeForm)
                .where(IntakeForm.firm_id == firm_id)
                .options(selectinload(IntakeForm.fields))
            )
        )

    def list_published_forms_by_firm(self, firm_id) -> list[IntakeForm]:
        return list(
            self.db.scalars(
                select(IntakeForm)
                .where(IntakeForm.firm_id == firm_id, IntakeForm.is_published.is_(True))
                .options(selectinload(IntakeForm.fields))
            )
        )

    def delete_form(self, form: IntakeForm):
        self.db.delete(form)
        self.db.flush()

    # Fields

    def create_field(self, field: IntakeFormField) -> IntakeFormField:
        self.db.add(field)
        self.db.flush()
        return field

    def get_field_by_id(self, field_id) -> IntakeFormField | None:
        return self.db.scalar(select(IntakeFormField).where(IntakeFormField.id == field_id))

    def get_field_by_key(self, form_id, key: str) -> IntakeFormField | None:
        return self.db.scalar(
            select(IntakeFormField).where(IntakeFormField.form_id == form_id, IntakeFormField.key == key)
        )

    def list_fields_by_form(self, form_id) -> list[IntakeFormField]:
        return list(
            self.db.scalars(
                select(IntakeFormField)
                .where(IntakeFormField.form_id == form_id)
                .order_by(IntakeFormField.display_order)
            )
        )

    def delete_field(self, field: IntakeFormField):
        self.db.delete(field)
        self.db.flush()

    def max_display_order(self, form_id) -> int:
        # Deliberately reuses list_fields_by_form's row-select rather than a func.max()
        # aggregate over the same predicate — the aggregate form was observed returning
        # NULL (so every new field landed at display_order 0) even when list_fields_by_form
        # correctly returned the existing rows for the same form_id in the same request.
        fields = self.list_fields_by_form(form_id)
        return max((f.display_order for f in fields), default=-1)

    # Submissions

    def create_submission(self, submission: IntakeSubmission) -> IntakeSubmission:
        self.db.add(submission)
        self.db.flush()
        return submission

    def get_submission_by_id(self, submission_id) -> IntakeSubmission | None:
        return self.db.scalar(
            select(IntakeSubmission)
            .where(IntakeSubmission.id == submission_id)
            .options(selectinload(IntakeSubmission.answers))
        )

    def list_submissions_by_firm(self, firm_id) -> list[IntakeSubmission]:
        return list(
            self.db.scalars(
                select(IntakeSubmission)
                .where(IntakeSubmission.firm_id == firm_id)
                .options(selectinload(IntakeSubmission.answers))
                .order_by(IntakeSubmission.created_at.desc())
            )
        )

    def list_submissions_by_contact(self, contact_id) -> list[IntakeSubmission]:
        return list(
            self.db.scalars(
                select(IntakeSubmission)
                .where(IntakeSubmission.contact_id == contact_id)
                .options(selectinload(IntakeSubmission.answers))
                .order_by(IntakeSubmission.created_at.desc())
            )
        )

    def list_recent_by_client(self, client_id, limit: int) -> list[IntakeSubmission]:
        statement = (
            select(IntakeSubmission)
            .where(IntakeSubmission.client_id == client_id)
            .options(selectinload(IntakeSubmission.answers))
            .order_by(IntakeSubmission.created_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(statement))

    def count_submissions_for_form(self, form_id) -> int:
        return self.db.scalar(
            select(func.count()).select_from(IntakeSubmission).where(IntakeSubmission.form_id == form_id)
        )

    # Answers

    def create_answer(self, answer: IntakeSubmissionAnswer) -> IntakeSubmissionAnswer:
        self.db.add(answer)
        self.db.flush()
        return answer

    def get_answer_by_id(self, answer_id) -> IntakeSubmissionAnswer | None:
        return self.db.scalar(select(IntakeSubmissionAnswer).where(IntakeSubmissionAnswer.id == answer_id))

    def delete_answer(self, answer: IntakeSubmissionAnswer):
        self.db.delete(answer)
        self.db.flush()

    def list_answers_with_fields(self, submission_id) -> list[tuple[IntakeSubmissionAnswer, IntakeFormField]]:
        statement = (
            select(IntakeSubmissionAnswer, IntakeFormField)
            .join(IntakeFormField, IntakeSubmissionAnswer.field_id == IntakeFormField.id)
            .where(IntakeSubmissionAnswer.submission_id == submission_id)
        )
        return list(self.db.execute(statement).all())

    def delete_submission(self, submission: IntakeSubmission):
        self.db.delete(submission)
        self.db.flush()
