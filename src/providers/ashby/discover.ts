import { config } from '../../config';
import { discoverSlugsViaCDX } from '../../slug-discover/common-crawl';

const CDX_PATTERN = 'jobs.ashbyhq.com/*';
const SLUG_RE = /jobs\.ashbyhq\.com\/([^/?#]+)/i;

export async function discoverAshbySlugs(): Promise<string[]> {
	return discoverSlugsViaCDX(CDX_PATTERN, SLUG_RE, config.discovery.ashby);
}
