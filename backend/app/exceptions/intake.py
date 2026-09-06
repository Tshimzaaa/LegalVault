class IntakeFormNotFound(Exception):
    pass


class IntakeFieldNotFound(Exception):
    pass


class IntakeSubmissionNotFound(Exception):
    pass


class IntakeAnswerNotFound(Exception):
    pass


class IntakeFormNotPublished(Exception):
    pass


class IntakeFormHasSubmissions(Exception):
    pass


class IntakeFieldLocked(Exception):
    pass


class MissingRequiredIntakeAnswer(Exception):
    pass


class UnsupportedIntakeFileType(Exception):
    pass


class SystemFormProtected(Exception):
    pass
