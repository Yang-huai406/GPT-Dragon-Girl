import { createHash } from 'node:crypto';
// Fingerprints identify shipped legacy dialogue without keeping it as runnable content.
const retired = new Set(["0c953f5604300d21c4b3d9942e62b7cba421ee03e453b28354475bde44d40c69","45991d3fd1739927be66dbdf749e91e0d66a8721d30646a37f02c1d1cd506f4f","40654d29124325685635ddbb068742bc2b260997b80b178a32677f671494415b","b38afbd3c5e623cbcabce42603f1e5561e39f2453ff677a27f33193b4466c915","12208e98773863267e1480cba5053885b1dc69c6b81ae550ec43478ec9929182","7df6e0463bded7ba428084445048f327347fef980b1da8c6db4ecdec187f1c81","7edffcc78aa8f58f714ff77d4727cad79c6b978b5634192d7ffd4f9bf73d86de","d20e3fe6899bdfbf2d5b82e491405ca392d350cc534ddbd6cbd44379a2ac26ed","4cc6cc8d935357b2d5cb78a96dbdd4215e8e7f8aafc7c585befbb51f5ce886de","3fe10e0c45e04e73cbb27e22ec361ec7d2fd5e20d731e61cd283fdfb043af92c","c0b1dc1d4386bedc098d08d0ee88696b1c5acff77f40cc3d3f5e8325792884ec","7e1d399d993944311af22d6e3dec4c0aa74f9b2b604708852ed8ad51fb98c4f5","dd07e71cdb80888cfa439b436364d67aa764867fa4d666aa305d551330bffda0","a5bf49161098eb8120b05521acbc0230b73bdf435937e7942391cdf10f9f0f0a","ec88970913e79c17893ac29e5721a1e325b34a2b205ea6e0d0513116acb04ffb","da3487cd65026265fe87fb98906ad15fa097ae11fb1405a9afb76c6aef545260","34ba64e24a785127902666e8a677279b84b31f171daa2ccff865589911bf2e10","9732abf3a9504d5a108a64f034eda41eb2c877d987b4699888b917ea4c35c4a4","3f5cd933fb66a9366e733328fbcc5f7354fbab1ef30a6e8d67e4c14c4eb6e0f0","1be4763c05e2c01a47710a87e446de8bcc9ef76e3d8b761f2c40c83e8ec452f8","8036f4d97dde7ac7663fb11a719486ccdc652b0ffa050432934da20e66209df7","5927bd4095a1d8d9da4963c6015ea5bbb4ac2b4cc05efdbdf064b1d42f93ad9d","a81393b0c34eadebaa21688b11f428106edeaf845f0d116190e5ddb074b76ceb","5436fa79c3241f765712bccfb7ec096d872d0ffb980c48ed42af0193b811679a","33c43981570efff1d87122bc8a454ab8fe719a85df322a70ecae7d50332a5c8c","31c6415388aacf134ca42d24a8ce1ae04d7f04bb546356d6fa62e308b2f4fc8f","097b5e189f156df029837365ac823b862c5910d3f4ca0c4557ded748004f1194","d7835a3ee50b7db199ad94a46a28e37005287eb3f6621461fc28b6fbfba1680a","074ca2071b720171285947253f2aae377e40642afdeb6574d84f2c5d79ef295d","183db8ce6487f4f20f2039960d3aece1f78570929215676f4dc95faf02c01543","5880b98d482a1c889190ce0f792ef2af25f9be79068a9dbe658f7cb6d9f63e05","0c96de8d86592c1ad94857415bc53b515b3c5ccf0b1420fd05f57d963de9c70e","78420e6e73c0ef1b8d37f8097d09fd95d088c0dd0d42113a49f1b4ed28950e8c","3b597b44b3cad796d68796b6afc8e92d20ffe5cb81f081bebf77719dfc4743b7","90038db348a3078327758d992fe0db095e14aa327916705ef817263eef0fa6d4","b7ff7b60a12e8cb37c8bf0cff25dfd7cad89b3954465517e81c1ae3b58d30d28","f5c52e135d83c300eea52aefe55f9a91d88df594e02194cb657ec9d806076ddc","7b0f9b14906c6662b021e91f7c20c89163ea6cf4adb7e448e3ed4a96e741f426","f3e4b5f35234916ea959bafd41a1cf50164e85a7976ff87eac558e5915d8048f","71d1d4ccd0ebf2c1a84f844c4e2e9f70e944e842ae5553d6aa321efed1890705","9921cae3cf51b5d6c018d7d8d00e555a07366ffebe84a7bd1baeb41dccf605d8","6dbf09048679ea974cf4888488a8e24e33164ee53c22af02e51cb51721599aa2","2b97e95136bfc25db5b7d41b4d40c0a18c8d7d5a2a58e75f028355a27df2a73c","cda55eab61b22f7786e3ca08d12e6f2c172b8663516c794d46327ec6e30fb03c","c7ce23866585a7423aec81a7f3aa9af54a094bfa848729412db2b6b199f873b4","a0e2fdf86c58c074bbe06777acd44b9a3e8c6cf04f924f4c8377fc8e739ca39a","f25b944b97ebd962c5fd4fc320b261b39d2eeee0c1756aecd1554cda83f177a4","40d86920ba273306eafcfdc887bc0ed404cf4661c6b3cb943b43b8a432a53360","834b239209a70d271b59115a85c0959ea5ec558706e67d47bbd01ef63a038a1b","e48dcf1b9ce139ec4940986b781b35cdf05447be0ad748fa59a72a8c89b1439f","f052294ee610bbc1edafc429c2ccf346b52fd1bc7641692224ad22f173cecdf6"]);
const oldLine = line => typeof line?.t === 'string' && retired.has(createHash('sha256').update(line.t.trim()).digest('hex'));
const balance = () => ({ type: 'balance', size: 16, tpl: '{balance_api}' });
export function sanitizeGptContent(value) {
  if (Array.isArray(value)) return value.map(sanitizeGptContent);
  if (!value || typeof value !== 'object') return value;
  let result = Object.fromEntries(Object.entries(value).map(([key,item]) => [key,sanitizeGptContent(item)]));
  if (result.kind === 'random') result = { ...result, kind: 'custom', modules: Array.isArray(result.modules) && result.modules.length ? result.modules : [balance()] };
  if (result.type === 'random' && Array.isArray(result.lines)) {
    const count = result.lines.filter(oldLine).length;
    // Recognize a shipped preset, not an isolated quote written by a user.
    if (count >= 3) {
      const custom = result.lines.filter(line => !oldLine(line));
      result = custom.length ? { ...result, lines: custom } : balance();
    }
  }
  if (result.type === 'text' && result.text === '当前 API 余额') result.i18nKey = 'widget.apiBalance';
  if (result.type === 'today' && result.tpl === '今日已观测 {expense_api}') result.tplI18nKey = 'widget.observedTodayExpenseApi';
  if (result.type === 'text') {
    const builtins = {
      '老大～你的 API 余额': ['backend.m057', 'API 余额'],
      'API 余额': ['backend.m057', 'API 余额'],
      '已经不足 {currency}{below} 啦': ['backend.m058', '低于 {currency}{below}'],
      '低于 {currency}{below}': ['backend.m058', '低于 {currency}{below}'],
      '打开当前 API 账单': ['backend.m059', '打开当前 API 账单'],
      '今天已观测用量超过': ['backend.m061', '今天已观测用量超过'],
      '记得关注 API 余额哦': ['backend.m132', '查看 API 余额'],
    };
    const known = builtins[result.text];
    if (known) { result.i18nKey = known[0]; result.text = known[1]; }
  }
  return result;
}
