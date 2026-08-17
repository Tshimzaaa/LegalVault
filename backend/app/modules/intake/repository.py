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
        return self.db.scalar(
            select(func.max(IntakeFormField.display_order)).where(IntakeFormField.form_id == form_id)
        ) or -1

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

    def delete_submission(self, submission: IntakeSubmission):
        self.db.delete(submission)
        self.db.flush()
