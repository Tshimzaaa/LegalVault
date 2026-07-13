import { useState } from 'react'
import type { FormEvent } from 'react'
import './NewMatter.css'
import { IconPlus, IconCalendar, IconSearch } from '../../components/icons'

function NewMatter() {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <main className="dash-main matter-main">
      <header className="dash-topbar matter-topbar">
        <h1>Open New Matter</h1>
      </header>

      <form className="matter-form" onSubmit={handleSubmit}>
        <div className="matter-col">
          <section className="card form-section">
            <h3>1. Matter Information</h3>

            <label className="field">
              <span>Matter Name</span>
              <input type="text" placeholder="Matter Name" />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Matter Type</span>
                <select defaultValue="">
                  <option value="" disabled>
                    Employment Law
                  </option>
                  <option value="corporate">Corporate</option>
                  <option value="litigation">Litigation</option>
                  <option value="family">Family Law</option>
                </select>
              </label>
              <label className="field">
                <span>Practice Area</span>
                <select defaultValue="">
                  <option value="" disabled>
                    Corporate
                  </option>
                  <option value="employment">Employment Law</option>
                  <option value="ip">Intellectual Property</option>
                  <option value="real-estate">Real Estate</option>
                </select>
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Assigned Attorney</span>
                <select defaultValue="">
                  <option value="" disabled>
                    Select attorney
                  </option>
                </select>
              </label>
              <label className="field">
                <span>Case Manager</span>
                <select defaultValue="">
                  <option value="" disabled>
                    Select case manager
                  </option>
                </select>
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Opened Date</span>
                <div className="input-with-icon">
                  <input type="text" placeholder="Date Picker" />
                  <IconCalendar />
                </div>
              </label>
              <label className="field">
                <span>Estimated Closing Date</span>
                <div className="input-with-icon">
                  <input type="text" placeholder="Date Picker" />
                  <IconCalendar />
                </div>
              </label>
            </div>

            <label className="field">
              <span>Description</span>
              <textarea placeholder="Matter Description" rows={3} />
            </label>
          </section>
        </div>

        <div className="matter-col">
          <section className="card form-section">
            <div className="form-section-header">
              <h3>2. Client Information</h3>
              <button type="button" className="add-client-btn">
                <IconPlus /> Add New Client
              </button>
            </div>

            <label className="field">
              <span>Client</span>
              <select defaultValue="">
                <option value="" disabled>
                  Select existing client
                </option>
              </select>
            </label>

            <div className="field-row">
              <label className="field">
                <span>First Name</span>
                <input type="text" placeholder="First Name" />
              </label>
              <label className="field">
                <span>Last Name</span>
                <input type="text" placeholder="Last Name" />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Company</span>
                <input type="text" placeholder="Company" />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" placeholder="Email" />
              </label>
            </div>

            <label className="field">
              <span>Address</span>
              <input type="text" placeholder="Address" />
            </label>
          </section>

          <section className="card form-section">
            <h3>4. Fee Arrangement</h3>

            <label className="field">
              <span>Fee Type</span>
              <select defaultValue="hourly">
                <option value="hourly">Hourly</option>
                <option value="flat">Flat Fee</option>
                <option value="contingency">Contingency</option>
                <option value="retainer">Retainer</option>
              </select>
            </label>
          </section>
        </div>

        <div className="matter-col">
          <section className="card form-section">
            <h3>3. Matter Details &amp; Strategy</h3>

            <label className="field">
              <span>Conflict Check</span>
              <div className="input-with-icon leading">
                <IconSearch />
                <input type="text" placeholder="Search names and entities to run conflict check" />
              </div>
            </label>

            <label className="field">
              <span>Client&rsquo;s Goal</span>
              <input type="text" placeholder="Client's Goal" />
            </label>

            <label className="field">
              <span>Case Strategy Notes</span>
              <textarea placeholder="Reference field for related matters" rows={2} />
            </label>
          </section>
        </div>

        <div className="matter-actions">
          <button type="button" className="btn-ghost">
            Cancel
          </button>
          <button type="submit" className="btn-solid">
            Open Matter
          </button>
        </div>
        {submitted && <p className="matter-success">Matter created.</p>}
      </form>
    </main>
  )
}

export default NewMatter
