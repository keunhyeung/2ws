(() => {
  'use strict';
  function create(terms, groups, {resolveId, namesOf, titleOf, connections = {}}) {
    const byId = new Map(terms.map(term => [term.id, term]));
    const canonical = id => byId.has(id) ? id : resolveId(id);
    const bundles = new Map();
    for (const [source, children] of Object.entries(groups)) {
      const id = canonical(source);
      if (!id) throw new Error('Unknown concept group ' + source);
      bundles.set(id, children.map(child => {
        const key = canonical(child);
        if (!key) throw new Error(source + ' refers to missing concept ' + child);
        return key;
      }));
    }
    const expanded = new Map();
    const expanding = new Set();
    function expand(id) {
      if (!bundles.has(id)) return [id];
      if (expanded.has(id)) return expanded.get(id);
      if (expanding.has(id)) throw new Error('Circular concept group ' + id);
      expanding.add(id);
      const children = [...new Set(bundles.get(id).flatMap(expand))];
      expanding.delete(id);
      expanded.set(id, children);
      return children;
    }
    for (const id of bundles.keys()) expand(id);

    const singles = terms.filter(term => !bundles.has(term.id));
    const neighbors = new Map(singles.map(term => [term.id, new Map()]));
    const topicNames = new Map(singles.map(term => [term.id, new Set()]));
    const layoutTopics = new Map(singles.map(term => [term.id, []]));
    const normalize = text => String(text).toLowerCase().replace(/\s+/g, '');
    function link(a, b, priority) {
      if (a === b) return;
      const rank = Math.min(neighbors.get(a).get(b) ?? Infinity, priority);
      neighbors.get(a).set(b, rank);
      neighbors.get(b).set(a, rank);
    }
    for (const term of terms) {
      const [source, alsoSource] = expand(term.id);
      if (alsoSource) continue;
      for (const entry of term.links || []) {
        const target = canonical(typeof entry === 'string' ? entry : entry.target || entry.id);
        if (!target) continue;
        const [dest, alsoDest] = expand(target);
        if (!alsoDest) link(source, dest, 0);
      }
    }
    for (const [id, children] of expanded) {
      const topic = byId.get(id);
      const oldNames = namesOf(topic).filter(Boolean).map(normalize);
      const layoutTopic = {id, chapter: topic.chapterId || topic.chapter, unitIds: topic.unitIds};
      for (const child of children) {
        for (const name of oldNames) topicNames.get(child).add(name);
        layoutTopics.get(child).push(layoutTopic);
      }
      const blocks = connections[id] ? connections[id].map(block =>
        [...new Set(block.flatMap(child => expand(canonical(child))))]
      ) : [children];
      for (const block of blocks) {
        for (const [i, child] of block.entries()) {
          for (const other of block.slice(i + 1)) link(child, other, block.length);
        }
      }
    }
    function adjacent(id) {
      return [...neighbors.get(id)].sort((a,b)=>a[1]-b[1]).map(([other])=>byId.get(other));
    }
    const graphTerms = singles.map(term => ({
      ...term,
      layoutTopics: layoutTopics.get(term.id),
      links: [...neighbors.get(term.id)].map(([target, priority]) => ({target, priority})),
    }));
    const keys = singles.map(term => ({
      term, title: normalize(titleOf(term)), names: namesOf(term).filter(Boolean).map(normalize),
      topics: [...topicNames.get(term.id)],
    }));
    function search(query, limit = 8) {
      const q = normalize(query);
      if (!q) return [];
      return keys.map(({term,title,names,topics}) => {
        let rank = 6;
        if (title === q || names.includes(q)) rank = 0;
        else if (names.some(name=>name.startsWith(q))) rank = 1;
        else if (names.some(name=>name.includes(q))) rank = 2;
        else if (topics.includes(q)) rank = 3;
        else if (topics.some(name=>name.startsWith(q))) rank = 4;
        else if (topics.some(name=>name.includes(q))) rank = 5;
        return {term,rank};
      }).filter(hit=>hit.rank < 6).sort((a,b)=>a.rank-b.rank).slice(0,limit).map(hit=>hit.term);
    }
    return {
      graphTerms, adjacent, search,
      members(id) { return expanded.get(canonical(id))?.map(child => byId.get(child)); },
    };
  }
  globalThis.AtomicAtlas = {create};
})();
