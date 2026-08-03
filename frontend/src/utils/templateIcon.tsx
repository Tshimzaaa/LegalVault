import {
  IconContractData,
  IconDollar,
  IconFilePlus,
  IconFolder,
  IconGavel,
  IconShield,
  IconSignedContract,
  IconUser,
} from '../components/icons'

/** Best-effort icon per template category, matched by keyword — falls back to a generic document icon. */
export function getTemplateIcon(category: string) {
  const c = category.toLowerCase()

  if (c.includes('nda') || c.includes('confidential')) return <IconShield />
  if (c.includes('employ')) return <IconUser />
  if (c.includes('lease') || c.includes('real estate') || c.includes('property')) return <IconFolder />
  if (c.includes('retainer') || c.includes('billing') || c.includes('fee')) return <IconDollar />
  if (c.includes('litigation') || c.includes('settlement')) return <IconGavel />
  if (c.includes('ip') || c.includes('intellectual') || c.includes('trademark') || c.includes('license'))
    return <IconSignedContract />
  if (c.includes('onboarding') || c.includes('engagement')) return <IconFilePlus />

  return <IconContractData />
}
