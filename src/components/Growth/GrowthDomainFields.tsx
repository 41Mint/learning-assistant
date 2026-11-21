import { GROWTH_DOMAIN_NAME_LIMIT, growthDomainOptions, hasGrowthDomain, withGrowthDomain } from '../../utils/growthDomains';
import { normalizedName } from '../../utils/knowledge';

export default function GrowthDomainFields({ domains, onChange, customName, onCustomNameChange }: {
  domains: string[];
  onChange: (domains: string[]) => void;
  customName: string;
  onCustomNameChange: (name: string) => void;
}) {
  const added = withGrowthDomain(domains, customName);
  const add = () => {
    onChange(added);
    onCustomNameChange('');
  };

  return <fieldset className="growth-domains">
    <legend>领域（可选）</legend>
    <div className="growth-domain-choices">
      {growthDomainOptions(domains).map((domain) => <label key={domain}>
        <input type="checkbox" checked={hasGrowthDomain(domains, domain)} onChange={(event) => onChange(event.target.checked
          ? withGrowthDomain(domains, domain) : domains.filter((item) => normalizedName(item) !== normalizedName(domain)))} />
        <span>{domain}</span>
      </label>)}
    </div>
    <div className="growth-custom-domain">
      <label>自定义领域<input className="workspace-input" type="text" autoComplete="off" placeholder="例如 输入系统"
        maxLength={GROWTH_DOMAIN_NAME_LIMIT} value={customName} onChange={(event) => onCustomNameChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          if (added !== domains) add();
        }} /></label>
      <button type="button" className="workspace-button" aria-label="添加领域" disabled={added === domains} onClick={add}>添加</button>
    </div>
  </fieldset>;
}
