/* eslint-disable complexity,max-depth,max-statements,no-continue,no-shadow */
const { execSync } = require("child_process");
const fs = require("fs");

const lang = process.argv[2];
if (!lang || !/^\w+$/.test(lang)) {
  throw new Error(
    'The first argument should be a language iso code (e.g., "fr")'
  );
}

const dir = "src";
const tools_dir = "tools";
const regexp_space = "[\\s\xa0]";
let valid_characters =
  "[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/\"'\\*=~\\-\\u2013\\u2014]";
let letters = "";
// prettier-ignore
const valid_osises = make_valid_osises(["Gen","Exod","Lev","Num","Deut","Josh","Judg","Ruth","1Sam","2Sam","1Kgs","2Kgs","1Chr","2Chr","Ezra","Neh","Esth","Job","Ps","Prov","Eccl","Song","Isa","Jer","Lam","Ezek","Dan","Hos","Joel","Amos","Obad","Jonah","Mic","Nah","Hab","Zeph","Hag","Zech","Mal","Matt","Mark","Luke","John","Acts","Rom","1Cor","2Cor","Gal","Eph","Phil","Col","1Thess","2Thess","1Tim","2Tim","Titus","Phlm","Heb","Jas","1Pet","2Pet","1John","2John","3John","Jude","Rev","Tob","Jdt","GkEsth","Wis","Sir","Bar","PrAzar","Sus","Bel","SgThree","EpJer","1Macc","2Macc","3Macc","4Macc","1Esd","2Esd","PrMan","AddEsth","AddDan"]);

const raw_abbrevs = {};
const vars = get_vars();
const abbrevs = get_abbrevs();
const order = get_order();
const all_abbrevs = make_tests();
make_regexps();
make_grammar();
const default_alternates_file = `${dir}/en/translation_alternates.coffee`;
make_translations();

function make_translations() {
  let out = get_file_contents(`${tools_dir}/template/translations.coffee`);
  const regexps = [];
  const aliases = [];
  vars.$TRANS.forEach((translation) => {
    const group = translation.split(",");
    const [trans, osis] = group;
    let [, , alias] = group;
    regexps.push(trans);
    if (!osis && !alias) {
      return;
    }
    if (!alias) {
      alias = "default";
    }
    let lc = trans.toLowerCase();
    if (/\W/.test(lc)) {
      lc = `"${lc}"`;
    }
    let string = `${lc}:`;
    if (osis) {
      string += `\x0a\t\t\tosis: "${osis}"`;
    }
    if (alias) {
      string += `\x0a\t\t\talias: "${alias}"`;
    }
    aliases.push(string);
  });
  const regexp = make_book_regexp("translations", regexps, 1);
  let alias = aliases.join("\x0a\t\t");
  if (fs.existsSync(`${dir}/${lang}/translation_aliases.coffee`)) {
    alias = get_file_contents(`${dir}/${lang}/translation_aliases.coffee`);
    out = out.replace(/\t+(\$TRANS_ALIAS)/g, "$1");
  }
  let alternate = get_file_contents(default_alternates_file);
  if (fs.existsSync(`${dir}/${lang}/translation_alternates.coffee`)) {
    alternate = get_file_contents(
      `${dir}/${lang}/translation_alternates.coffee`
    );
  }
  out = out.replace(/\$TRANS_REGEXP/g, regexp);
  out = out.replace(/\$TRANS_ALIAS/g, alias);
  out = out.replace(/\s*\$TRANS_ALTERNATE/g, `\n${alternate}`);
  const lang_isos = JSON.stringify(vars.$LANG_ISOS);
  out = out.replace(/\$LANG_ISOS/g, lang_isos);
  fs.writeFileSync(`${dir}/${lang}/translations.coffee`, out);
  const found = out.match(/(\$[A-Z_]+)/);
  if (found) {
    throw new Error(`${found}\nTranslations: Capital variable`);
  }
}

function make_grammar() {
  let out = get_file_contents(`${tools_dir}/template/grammar.pegjs`);
  if (!vars.$NEXT) {
    out = out.replace(/\nnext_v\s+=.+\s+\{ return[^}]+\}\s+\}\s+/, "\n");
    out = out.replace(/\bnext_v \/ /g, "");
    out = out.replace(/\$NEXT \/ /g, "");
    if (/\bnext_v\b|\$NEXT/.test(out)) {
      throw new Error("Grammar: next_v");
    }
  }
  Object.keys(vars)
    .sort()
    .forEach((key) => {
      const safe_key = key.replace(/^\$/, "\\$");
      const re = new RegExp(`${safe_key}`, "g");
      out = out.replace(re, () => format_var("pegjs", key));
    });
  fs.writeFileSync(`${dir}/${lang}/grammar.pegjs`, out);
  const found = out.match(/(\$[A-Z_]+)/);
  if (found) {
    throw new Error(`${found}\nGrammar: Capital variable`);
  }
}

function make_regexps() {
  let out = get_file_contents(`${tools_dir}/template/regexps.coffee`);
  if (!vars.$NEXT) {
    out = out.replace(/\n.+\$NEXT.+\n/, "\n");
    if (/\$NEXT\b/.test(out)) {
      throw new Error("Regexps: next");
    }
  }
  const osises = [...order];
  Object.keys(raw_abbrevs)
    .sort()
    .forEach((osis) => {
      if (!/,/.test(osis)) {
        return;
      }
      const temp = osis.replace(/,+$/, "");
      const apocrypha =
        valid_osises[temp] && valid_osises[temp] === "apocrypha" ? 1 : 0;
      osises.push({ osis, apocrypha });
    });
  const book_regexps = make_regexp_set(osises);
  out = out.replace(/\$BOOK_REGEXPS/, book_regexps);
  out = out.replace(/\$VALID_CHARACTERS/, valid_characters);
  out = out.replace(
    /\$PRE_PASSAGE_ALLOWED_CHARACTERS/,
    vars.$PRE_PASSAGE_ALLOWED_CHARACTERS.join("|")
  );
  const pre = vars.$PRE_BOOK_ALLOWED_CHARACTERS
    .map((c) => format_value("quote", c))
    .join("|");
  out = out.replace(/\$PRE_BOOK_ALLOWED_CHARACTERS/, pre);
  let passage_components = [];
  const variables = ["$CHAPTER", "$NEXT", "$FF", "$TO", "$AND", "$VERSE"];
  variables.forEach((variable) => {
    if (vars[variable]) {
      passage_components = passage_components.concat(
        vars[variable].map((v) => format_value("regexp", v))
      );
    }
  });
  passage_components.sort((a, b) => b.length - a.length);
  out = out.replace(/\$PASSAGE_COMPONENTS/, passage_components.join(" | "));
  Object.keys(vars)
    .sort()
    .forEach((key) => {
      const safe_key = key.replace(/^\$/, "\\$");
      const re = new RegExp(`${safe_key}(?!\\w)`, "g");
      out = out.replace(re, () => format_var("regexp", key));
    });
  fs.writeFileSync(`${dir}/${lang}/regexps.coffee`, out);
  const found = out.match(/(\$[A-Z_]+)/);
  if (found) {
    throw new Error(`${found}\nRegexps: Capital variable`);
  }
}

function make_regexp_set(osises) {
  const out = [];
  let has_psalm_cb = 0;
  osises.forEach((ref) => {
    const { osis, apocrypha } = ref;
    if (
      osis === "Ps" &&
      !has_psalm_cb &&
      fs.existsSync(`${dir}/${lang}/psalm_cb.coffee`)
    ) {
      out.push(get_file_contents(`${dir}/${lang}/psalm_cb.coffee`));
      has_psalm_cb = 1;
    }
    const safes = {};
    Object.keys(raw_abbrevs[osis]).forEach((abbrev) => {
      const safe = abbrev.replace(/[[\]?]/g, "");
      safes[safe] = safe.length;
    });
    out.push(
      make_regexp(
        osis,
        apocrypha,
        Object.keys(safes).sort((a, b) => safes[b] > safes[a])
      )
    );
  });
  return out.join("\x0a\t,\x0a");
}

function make_regexp(osis, apocrypha, safes) {
  const out = [];
  const abbrevs = [];
  safes.forEach((abbrev) => {
    abbrev = abbrev.replace(/ /g, `${regexp_space}*`);
    abbrev = abbrev.replace(/[\u200b]/g, () => {
      return `${regexp_space.replace(/\]$/, "\u200b]")}*`;
    });
    abbrev = handle_accent(abbrev);
    abbrev = abbrev.replace(/(\$[A-Z]+)(?!\w)/g, (_match, p1) => {
      return `${format_var("regexp", p1)}\\.?`;
    });
    abbrevs.push(abbrev);
  });
  const book_regexp = make_book_regexp(osis, all_abbrevs[osis], 1);
  osis = osis.replace(/,+$/, "");
  osis = osis.replace(/,/g, '", "');
  out.push(`\t\tosis: ["${osis}"]\x0a\t\t`);
  if (apocrypha) {
    out.push(`apocrypha: true\x0a\t\t`);
  }
  let pre = "#{bcv_parser::regexps.pre_book}";
  if (/^[0-9]/.test(osis) || /[0-9]/.test(abbrevs.join("|"))) {
    pre = vars.$PRE_BOOK_ALLOWED_CHARACTERS
      .map((v) => format_value("quote", v))
      .join("|");
    if (pre === "\\\\d|\\\\b") {
      pre = "\b";
    }
    pre = pre.replace(/\\+d\|?/, "");
    pre = pre.replace(/^\|+/, "");
    pre = pre.replace(/^\||\|\||\|$/, ""); // remove leftover |
    pre = pre.replace(/^\[\^/, "[^0-9"); // if it's a negated class, add \d
  }
  const post = vars.$POST_BOOK_ALLOWED_CHARACTERS.join("|");
  out.push(`regexp: ///(^|${pre})(\x0a\t\t`);
  out.push(book_regexp);
  out[out.length - 1] = out[out.length - 1].replace(/-(?!\?)/g, "-?");
  out.push(`\x0a\t\t\t)(?:(?=${post})|$)///gi`);
  return out.join("");
}

function make_book_regexp(osis, abbrevs, recurse_level) {
  abbrevs = abbrevs.map((abbrev) => {
    return abbrev.replace(/\\/g, "");
  });
  const subsets = get_book_subsets(abbrevs);
  const out = [];
  subsets.forEach((subset) => {
    const json = JSON.stringify(subset);
    let base64 = Buffer.from(json).toString("base64");
    console.log(`${osis} ${base64.length}`);

    let use_file = 0;
    if (base64.length > 128_000) {
      // Ubuntu limitation
      use_file = 1;
      fs.writeFileSync("./temp.txt", json);
      base64 = "<";
    }

    let regexp = execSync(`node ./bin/make_regexps.js "${base64}"`);
    if (use_file) {
      fs.rmSync("./temp.txt");
    }
    regexp = JSON.parse(regexp.toString());
    if (!regexp.patterns) {
      throw new Error("No regexp json object");
    }

    const patterns = [];
    regexp.patterns.forEach((pattern) => {
      pattern = format_node_regexp_pattern(pattern);
      patterns.push(pattern);
    });
    let pattern = patterns.join("|");
    pattern = validate_node_regexp(osis, pattern, subset, recurse_level);
    out.push(pattern);
  });
  validate_full_node_regexp(osis, out.join("|"), abbrevs);
  return out.join("|");
}

function validate_full_node_regexp(osis, pattern, abbrevs) {
  const matcher = new RegExp(`^(?:${pattern})`);
  abbrevs.forEach((abbrev) => {
    if (!matcher.test(abbrev)) {
      console.log(`  Not parsable (${abbrev}): '${matcher}'\n${pattern}`);
    }
  });
}

function get_book_subsets(abbrevs) {
  if (abbrevs.length <= 20) {
    return [abbrevs];
  }
  const groups = [[]];
  const subs = {};
  abbrevs.sort((a, b) => b.length - a.length);
  while (abbrevs.length !== 0) {
    const long = abbrevs.shift();
    if (subs[long]) {
      continue;
    }
    for (let i = 0; i < abbrevs.length; i++) {
      const short = quote_meta(abbrevs[i]);
      const re = new RegExp(
        `(?:^|[\\s\\p{Punctuation}\\p{P}])${short}(?:[\\s\\p{Punctuation}\\p{P}]|$)`,
        "iu"
      );
      if (!re.test(long)) {
        continue;
      }
      if (!subs[abbrevs[i]]) {
        subs[abbrevs[i]] = 0;
      }
      subs[abbrevs[i]]++;
    }
    groups[0].push(long);
  }
  if (Object.keys(subs).length) {
    groups[1] = Object.keys(subs).sort((a, b) => b.length - a.length);
  }
  return groups;
}

function validate_node_regexp(osis, pattern, abbrevs, recurse_level, note) {
  const [oks, not_oks] = check_regexp_pattern(osis, pattern, abbrevs);
  if (!not_oks.length) {
    return pattern;
  }
  if (recurse_level > 10) {
    console.log(`Splitting ${osis} by length...`);
    if (note && note === "lengths") {
      throw new Error(`'Lengths' didn't work: ${osis}`);
    }
    const lengths = split_by_length(abbrevs);
    const patterns = [];
    lengths
      .sort()
      .reverse()
      .forEach((length) => {
        patterns.push(make_book_regexp(osis, lengths[length], 1));
      });
    return validate_node_regexp(
      osis,
      patterns.join("|"),
      abbrevs,
      recurse_level + 1,
      "lengths"
    );
  }
  console.log(`  Recurse (${osis}): ${recurse_level}`);
  const ok_pattern = make_book_regexp(osis, oks, recurse_level + 1);
  const not_ok_pattern = make_book_regexp(osis, not_oks, recurse_level + 1);
  const shortest_ok = oks.sort((a, b) => a.length - b.length)[0];
  const shortest_not_ok = not_oks.sort((a, b) => a.length - b.length)[0];
  let new_pattern =
    shortest_ok.length > shortest_not_ok.length && recurse_level < 10
      ? `${ok_pattern}|${not_ok_pattern}`
      : `${not_ok_pattern}|${ok_pattern}`;
  new_pattern = validate_node_regexp(
    osis,
    new_pattern,
    abbrevs,
    recurse_level + 1,
    "final"
  );
  return new_pattern;
}

function split_by_length(abbrevs) {
  const lengths = {};
  abbrevs.forEach((abbrev) => {
    const length = Math.floor(abbrev.length / 2);
    if (!lengths[length]) {
      lengths[length] = [];
    }
    lengths[length].push(abbrev);
  });
  return lengths;
}

function check_regexp_pattern(osis, pattern, abbrevs) {
  const oks = [];
  const not_oks = [];
  const matcher = new RegExp(`^(?:${pattern})`, "i");
  abbrevs.forEach((abbrev) => {
    let compare = `${abbrev} 1`;
    compare = compare.replace(matcher, "");
    if (compare === " 1") {
      oks.push(abbrev);
    } else {
      not_oks.push(abbrev);
    }
  });
  return [oks, not_oks];
}

function format_node_regexp_pattern(pattern) {
  if (!/^\/\^/.test(pattern) || !/\$\/$/.test(pattern)) {
    throw new Error(`Unexpected regexp pattern: ${pattern}`);
  }
  pattern = pattern.replace(/^\/\^/, "");
  pattern = pattern.replace(/\$\/$/, "");
  if (/\[/.test(pattern)) {
    const parts = pattern.split("[");
    const out = [parts.shift()];
    while (parts.length !== 0) {
      let part = parts.shift();
      if (/\\$/.test(out[out.length - 1])) {
        out.push(part);
        continue;
      }
      if (!/[- ]/.test(part)) {
        out.push(part);
        continue;
      }
      let has_space = 0;
      const chars = part.split("");
      let out_chars = [];
      while (chars.length !== 0) {
        const char = chars.shift();
        if (char === "\\") {
          out_chars.push(char);
          out_chars.push(chars.shift());
          continue;
        } else if (char === "-") {
          out_chars.push("\\-");
        } else if (char === "]") {
          out_chars.push(char);
          if (has_space && (!chars.length || !/^[*+]/.test(chars[0]))) {
            out_chars.push("*");
          }
          out_chars = out_chars.concat(chars);
          break;
        } else if (char === " ") {
          out_chars.push("::OPTIONAL_SPACE::");
          has_space = 1;
        } else {
          out_chars.push(char);
        }
      }
      part = out_chars.join("");
      out.push(part);
    }
    pattern = out.join("[");
  }
  pattern = pattern.replace(/ /g, "[\\s\\xa0]*");
  pattern = pattern.replace(/::OPTIONAL_SPACE::/g, "\\s\\xa0");
  pattern = pattern.replace(/\u2009/g, "[\\s\\xa0]");
  return pattern;
}

function format_value(type, value) {
  vars.$TEMP_VALUE = [value];
  return format_var(type, "$TEMP_VALUE");
}

function format_var(type, var_name) {
  let values = vars[var_name];
  if (type === "regexp" || type === "quote") {
    values = values.map((value) => {
      value = value.replace(/\.$/, "");
      value = value.replace(/!(.+)$/, "(?!$1)");
      if (type === "quote") {
        value = value.replace(/\\/g, "\\\\");
        value = value.replace(/"/g, '\\"');
      }
      return value;
    });
    let out = values.join("|");
    out = handle_accents(out);
    out = out.replace(/ +/g, "#{bcv_parser::regexps.space}+");
    return values.length > 1 ? `(?:${out})` : out;
  } else if (type === "pegjs") {
    values = values.map((value) => {
      value = value.replace(/\.(?!`)/, '" abbrev? "');
      value = value.replace(/\.`/, '" abbrev "');
      value = value.replace(/([A-Z])/g, (_match, p1) => p1.toLowerCase());
      value = handle_accents(value);
      value = value.replace(/\[/g, '" [');
      value = value.replace(/\]/g, '] "');
      value = `"${value}"`;
      value = value.replace(/\s*!\[/, '" ![');
      value = value.replace(/\s*!([^[])/, '" !"$1');
      value = value.replace(/"{2,}/g, "");
      value = value.replace(/^\s+|\s+$/g, "");
      value += " ";
      const out = [];
      const parts = value.split('"');
      let is_outside_quote = 1;
      while (parts.length !== 0) {
        let part = parts.shift();
        if (is_outside_quote === 0) {
          part = part.replace(/^ /, () => {
            out[out.length - 1] += "space ";
            return "";
          });
          part = part.replace(/ /g, '" space "');
          part = part.replace(
            /((?:^|")[^"]+?")( space )/g,
            (_match, p1, p2) => {
              let quote = p1;
              const space = p2;
              if (/[\u0080-\uffff]/.test(quote)) {
                quote += "i";
              }
              return `${quote}${space}`;
            }
          );
          out.push(part);
          if (/[\u0080-\uffff]/.test(part)) {
            parts[0] = `i${parts[0]}`;
          }
          is_outside_quote = 1;
        } else {
          out.push(part);
          is_outside_quote = 0;
        }
      }
      value = out.join('"');
      value = value.replace(/\[([^\]]*?[\u0080-\uffff][^\]]*?)\]/g, "[$1]i");
      value = value.replace(/!(space ".+)/, "!($1)");
      value = value.replace(/\s+$/, "");
      if (var_name === "$TO") {
        value += " sp";
      }
      return value;
    });
    let out = values.join(" / ");
    if (
      (var_name === "$TITLE" || var_name === "$NEXT" || var_name === "$FF") &&
      values.length > 1
    ) {
      out = `( ${out} )`;
    } else if (
      values.length >= 2 &&
      (var_name === "$CHAPTER" ||
        var_name === "$VERSE" ||
        var_name === "$NEXT" ||
        var_name === "$FF")
    ) {
      out = handle_pegjs_prepends(out, values);
    }
    return out;
  } else {
    throw new Error(`Unknown var type: ${type} / ${var_name}`);
  }
}

function handle_pegjs_prepends(out, values) {
  const count = values.length;
  const lcs = {};
  values.forEach((c) => {
    if (!/^"/.test(c)) {
      return;
    }
    for (let length = 2; length <= c.length; length++) {
      if (!lcs[c.substring(0, length)]) {
        lcs[c.substring(0, length)] = [];
      }
      lcs[c.substring(0, length)].push(c);
    }
  });
  let longest = "";
  Object.keys(lcs).forEach((lc) => {
    if (lcs[lc].length === count && lc.length > longest.length) {
      longest = lc;
    }
  });
  if (!longest) {
    return out;
  }
  const length = longest.length;
  const out_array = [];
  for (let c of values) {
    c = c.substring(length);
    if (!/^\s*\[|^\s*abbrev\?/.test(c)) {
      c = `"${c}`;
    }
    if (c === '"') {
      return out;
    }
    c = c.replace(/^"" /, "");
    if (!c.length) {
      continue;
    }
    out_array.push(c);
  }
  if (!/"i?\s*$/.test(longest)) {
    longest += '"';
    if (/[\u0080-\uffff]/.test(longest)) {
      longest += "i";
    }
  }
  return `${longest} ( ${out_array.join(" / ")} )`;
}

function make_tests() {
  let out_array = [];
  const osises = [...order];
  const all_abbrevs = {};
  Object.keys(abbrevs)
    .sort()
    .forEach((osis) => {
      if (!/,/.test(osis)) {
        return;
      }
      osises.push({ osis, apocrypha: 0 });
    });

  osises.forEach((ref) => {
    const { osis } = ref;
    const tests = [];
    const [first] = osis.split(",");
    const match = `${first}.1.1`;
    sort_abbrevs_by_length(Object.keys(abbrevs[osis])).forEach((abbrev) => {
      expand_abbrev_vars(abbrev).forEach((expanded) => {
        add_abbrev_to_all_abbrevs(osis, expanded, all_abbrevs);
        tests.push(
          `\t\texpect(p.parse("${expanded} 1:1").osis()).toEqual("${match}");`
        );
      });
      osises.forEach((alt_osis) => {
        if (osis === alt_osis) {
          return;
        }
        if (!abbrevs[alt_osis]) {
          return;
        }
        Object.keys(abbrevs[alt_osis]).forEach((alt_abbrev) => {
          if (alt_abbrev.length < abbrev.length) {
            return;
          }
          const q_abbrev = quote_meta(abbrev);
          if (new RegExp(`\b${q_abbrev}\b`).test(alt_abbrev)) {
            for (const check of osis) {
              if (alt_osis === check) {
                // if alt_osis comes first, that's what we want
                break;
              } else if (osis !== check) {
                // we only care about osis
                continue;
              }
              console.log(
                `${alt_osis} should be before ${osis} in parsing order\n  ${alt_abbrev} matches ${abbrev}`
              );
            }
          }
        });
      });
    });
    out_array.push(`describe("Localized book ${osis} (${lang})", () => {`);
    out_array.push("\tlet p = {};");
    out_array.push("\tbeforeEach(() => {");
    out_array.push("\t\tp = new bcv_parser();");
    out_array.push(
      '\t\tp.set_options({book_alone_strategy: "ignore",book_sequence_strategy: "ignore",osis_compaction_strategy: "bc",captive_end_digits_strategy: "delete"});'
    );
    out_array.push("\t\tp.include_apocrypha(true);");
    out_array.push("\t});");
    out_array.push(`\tit("should handle book: ${osis} (${lang})", () => {`);
    out_array = out_array.concat(tests);
    out_array = out_array.concat(add_non_latin_digit_tests(osis, tests));

    // Don't check for an empty string because books like EpJer will lead to Jer in language-specific ways.
    if (valid_osises[first] !== "apocrypha") {
      out_array.push("\t\tp.include_apocrypha(false);");
      sort_abbrevs_by_length(Object.keys(abbrevs[osis])).forEach((abbrev) => {
        expand_abbrev_vars(abbrev).forEach((expanded) => {
          expanded = uc_normalize(expanded);
          out_array.push(
            `\t\texpect(p.parse("${expanded} 1:1").osis()).toEqual("${match}");`
          );
        });
      });
    }
    out_array.push("\t});");
    out_array.push("});");
  });

  const fd = fs.openSync(`${dir}/${lang}/book_names.txt`, "w");
  Object.keys(all_abbrevs)
    .sort()
    .forEach((osis) => {
      const osis_abbrevs = sort_abbrevs_by_length(
        Object.keys(all_abbrevs[osis])
      );
      const use_osis = osis.replace(/,+$/, "");
      osis_abbrevs.forEach((abbrev) => {
        const use = abbrev.replace(/\u2009/g, " ");
        fs.writeSync(fd, `${use_osis}\t${use}\n`);
      });
      all_abbrevs[osis] = osis_abbrevs;
    });

  let misc_tests = [];
  misc_tests = misc_tests.concat(add_range_tests());
  misc_tests = misc_tests.concat(add_chapter_tests());
  misc_tests = misc_tests.concat(add_verse_tests());
  misc_tests = misc_tests.concat(add_sequence_tests());
  misc_tests = misc_tests.concat(add_title_tests());
  misc_tests = misc_tests.concat(add_ff_tests());
  misc_tests = misc_tests.concat(add_next_tests());
  misc_tests = misc_tests.concat(add_trans_tests());
  misc_tests = misc_tests.concat(add_book_range_tests());
  misc_tests = misc_tests.concat(add_boundary_tests());
  let out = get_file_contents(`${tools_dir}/template/spec.js`);
  const lang_isos = JSON.stringify(vars.$LANG_ISOS);
  out = out.replace(/\$LANG_ISOS/g, lang_isos);
  out = out.replace(/\$LANG/g, lang);
  out = out.replace(/\$BOOK_TESTS/, out_array.join("\x0a"));
  out = out.replace(/\$MISC_TESTS/, misc_tests.join("\x0a"));

  fs.writeFileSync(`${dir}/${lang}/spec.js`, out);
  let found = out.match(/(\$[A-Z]+)/);
  if (found) {
    throw new Error(`${found}\nTests: Capital variable`);
  }
  found = out.match(/(\$[A-Z])/);
  if (found) {
    throw new Error(`${found}\nTests: Capital variable`);
  }
  return all_abbrevs;
}

function sort_abbrevs_by_length(abbrevs) {
  const lengths = {};
  let out = [];
  abbrevs.forEach((abbrev) => {
    const length = abbrev.length;
    if (!lengths[length]) {
      lengths[length] = [];
    }
    lengths[length].push(abbrev);
  });
  // Since keys are numbers, they will be sorted.
  Object.keys(lengths)
    .reverse()
    .forEach((length) => {
      const sortedAbbrevs = lengths[length].sort();
      out = out.concat(sortedAbbrevs);
    });
  return out;
}

function add_abbrev_to_all_abbrevs(osis, abbrev, all_abbrevs) {
  if (/\./.test(abbrev) && abbrev !== "\u0418.\u041d") {
    // split by '.', while removing any empty fields
    const news = abbrev.match(/[^.]+/g) ?? [];
    let olds = [news.shift()];
    news.forEach((n) => {
      const temp = [];
      olds.forEach((old) => {
        temp.push(`${old}.${n}`);
        temp.push(`${old}${n}`);
      });
      olds = temp;
    });
    olds.forEach((old) => {
      all_abbrevs[osis] = {
        ...all_abbrevs[osis],
        [old]: 1,
      };
    });
  } else {
    all_abbrevs[osis] = {
      ...all_abbrevs[osis],
      [abbrev]: 1,
    };
  }
}

function add_non_latin_digit_tests(osis, tests) {
  const temp = tests.join("\n");
  const out = [];
  if (
    !/[\u0660-\u0669\u06f0-\u06f9\u07c0-\u07c9\u0966-\u096f\u09e6-\u09ef\u0a66-\u0a6f\u0ae6-\u0aef\u0b66-\u0b6f\u0be6-\u0bef\u0c66-\u0c6f\u0ce6-\u0cef\u0d66-\u0d6f\u0e50-\u0e59\u0ed0-\u0ed9\u0f20-\u0f29\u1040-\u1049\u1090-\u1099\u17e0-\u17e9\u1810-\u1819\u1946-\u194f\u19d0-\u19d9\u1a80-\u1a89\u1a90-\u1a99\u1b50-\u1b59\u1bb0-\u1bb9\u1c40-\u1c49\u1c50-\u1c59\ua620-\ua629\ua8d0-\ua8d9\ua900-\ua909\ua9d0-\ua9d9\uaa50-\uaa59\uabf0-\uabf9\uff10-\uff19]/.test(
      temp
    )
  ) {
    return out;
  }
  out.push("\t});");
  out.push(
    `\tit("should handle non-Latin digits in book: ${osis} (${lang})", () => {`
  );
  out.push('\t\tp.set_options({non_latin_digits_strategy: "replace"});');
  return out.concat(tests);
}

function add_range_tests() {
  const out = [];
  out.push(`\tit("should handle ranges (${lang})", () => {`);
  vars.$TO.forEach((abbrev) => {
    expand_abbrev(remove_exclamations(handle_accents(abbrev))).forEach((to) => {
      out.push(
        `\t\texpect(p.parse("Titus 1:1 ${to} 2").osis()).toEqual("Titus.1.1-Titus.1.2");`
      );
      out.push(
        `\t\texpect(p.parse("Matt 1${to}2").osis()).toEqual("Matt.1-Matt.2");`
      );
      out.push(
        `\t\texpect(p.parse("Phlm 2 ${uc_normalize(
          to
        )} 3").osis()).toEqual("Phlm.1.2-Phlm.1.3");`
      );
    });
  });
  out.push("\t});");
  return out;
}

function add_chapter_tests() {
  const out = [];
  out.push(`\tit("should handle chapters (${lang})", () => {`);
  vars.$CHAPTER.forEach((abbrev) => {
    expand_abbrev(remove_exclamations(handle_accents(abbrev))).forEach(
      (chapter) => {
        out.push(
          `\t\texpect(p.parse("Titus 1:1, ${chapter} 2").osis()).toEqual("Titus.1.1,Titus.2");`
        );
        out.push(
          `\t\texpect(p.parse("Matt 3:4 ${uc_normalize(
            chapter
          )} 6").osis()).toEqual("Matt.3.4,Matt.6");`
        );
      }
    );
  });
  out.push("\t});");
  return out;
}

function add_verse_tests() {
  const out = [];
  out.push(`\tit("should handle verses (${lang})", () => {`);
  vars.$VERSE.forEach((abbrev) => {
    expand_abbrev(remove_exclamations(handle_accents(abbrev))).forEach(
      (verse) => {
        out.push(
          `\t\texpect(p.parse("Exod 1:1 ${verse} 3").osis()).toEqual("Exod.1.1,Exod.1.3");`
        );
        out.push(
          `\t\texpect(p.parse("Phlm ${uc_normalize(
            verse
          )} 6").osis()).toEqual("Phlm.1.6");`
        );
      }
    );
  });
  out.push("\t});");
  return out;
}

function add_sequence_tests() {
  const out = [];
  out.push(`\tit("should handle 'and' (${lang})", () => {`);
  vars.$AND.forEach((abbrev) => {
    expand_abbrev(remove_exclamations(handle_accents(abbrev))).forEach(
      (and) => {
        out.push(
          `\t\texpect(p.parse("Exod 1:1 ${and} 3").osis()).toEqual("Exod.1.1,Exod.1.3");`
        );
        out.push(
          `\t\texpect(p.parse("Phlm 2 ${uc_normalize(
            and
          )} 6").osis()).toEqual("Phlm.1.2,Phlm.1.6");`
        );
      }
    );
  });
  out.push("\t});");
  return out;
}

function add_title_tests() {
  const out = [];
  out.push(`\tit("should handle titles (${lang})", () => {`);
  vars.$TITLE.forEach((abbrev) => {
    expand_abbrev(remove_exclamations(handle_accents(abbrev))).forEach(
      (title) => {
        out.push(
          `\t\texpect(p.parse("Ps 3 ${title}, 4:2, 5:${title}").osis()).toEqual("Ps.3.1,Ps.4.2,Ps.5.1");`
        );
        out.push(
          `\t\texpect(p.parse("${uc_normalize(
            `Ps 3 ${title}, 4:2, 5:${title}`
          )}").osis()).toEqual("Ps.3.1,Ps.4.2,Ps.5.1");`
        );
      }
    );
  });
  out.push("\t});");
  return out;
}

function add_ff_tests() {
  const out = [];
  out.push(`\tit("should handle 'ff' (${lang})", () => {`);
  if (lang === "it") {
    out.push('\t\tp.set_options({case_sensitive: "books"});');
  }
  vars.$FF.forEach((abbrev) => {
    expand_abbrev(remove_exclamations(handle_accents(abbrev))).forEach((ff) => {
      out.push(
        `\t\texpect(p.parse("Rev 3${ff}, 4:2${ff}").osis()).toEqual("Rev.3-Rev.22,Rev.4.2-Rev.4.11");`
      );
      if (lang !== "it") {
        out.push(
          `\t\texpect(p.parse("${uc_normalize(
            `Rev 3 ${ff}, 4:2 ${ff}`
          )}").osis()).toEqual("Rev.3-Rev.22,Rev.4.2-Rev.4.11");`
        );
      }
    });
  });
  if (lang === "it") {
    out.push('\t\tp.set_options({case_sensitive: "none"});');
  }
  out.push("\t});");
  return out;
}

function add_next_tests() {
  if (!vars.$NEXT) {
    return [];
  }
  const out = [];
  out.push(`\tit("should handle 'next' (${lang})", () => {`);
  if (lang === "it") {
    out.push('\t\tp.set_options({case_sensitive: "books"});');
  }
  vars.$NEXT.forEach((abbrev) => {
    expand_abbrev(remove_exclamations(handle_accents(abbrev))).forEach(
      (next) => {
        out.push(
          `\t\texpect(p.parse("Rev 3:1${next}, 4:2${next}").osis()).toEqual("Rev.3.1-Rev.3.2,Rev.4.2-Rev.4.3");`
        );
        if (lang !== "it") {
          out.push(
            `\t\texpect(p.parse("${uc_normalize(
              `Rev 3 ${next}, 4:2 ${next}`
            )}").osis()).toEqual("Rev.3-Rev.4,Rev.4.2-Rev.4.3");`
          );
        }
        out.push(
          `\t\texpect(p.parse("Jude 1${next}, 2${next}").osis()).toEqual("Jude.1.1-Jude.1.2,Jude.1.2-Jude.1.3");`
        );
        out.push(
          `\t\texpect(p.parse("Gen 1:31${next}").osis()).toEqual("Gen.1.31-Gen.2.1");`
        );
        out.push(
          `\t\texpect(p.parse("Gen 1:2-31${next}").osis()).toEqual("Gen.1.2-Gen.2.1");`
        );
        out.push(
          `\t\texpect(p.parse("Gen 1:2${next}-30").osis()).toEqual("Gen.1.2-Gen.1.3,Gen.1.30");`
        );
        out.push(
          `\t\texpect(p.parse("Gen 50${next}, Gen 50:26${next}").osis()).toEqual("Gen.50,Gen.50.26");`
        );
        out.push(
          `\t\texpect(p.parse("Gen 1:32${next}, Gen 51${next}").osis()).toEqual("");`
        );
      }
    );
  });
  if (lang === "it") {
    out.push('\t\tp.set_options({case_sensitive: "none"});');
  }
  out.push("\t});");
  return out;
}

function add_trans_tests() {
  const out = [];
  out.push(`\tit("should handle translations (${lang})", () => {`);
  [...vars.$TRANS].sort().forEach((abbrev) => {
    expand_abbrev(remove_exclamations(handle_accents(abbrev))).forEach(
      (translation) => {
        const [trans, maybe_osis] = translation.split(",");
        const osis = maybe_osis ? maybe_osis : trans;
        out.push(
          `\t\texpect(p.parse("Lev 1 (${trans})").osis_and_translations()).toEqual([["Lev.1", "${osis}"]]);`
        );
        out.push(
          `\t\texpect(p.parse("${`Lev 1 ${trans}`.toLowerCase()}").osis_and_translations()).toEqual([["Lev.1", "${osis}"]]);`
        );
      }
    );
  });
  out.push("\t});");
  return out;
}

function add_book_range_tests() {
  const [first] = expand_abbrev(handle_accents(vars.$FIRST[0]));
  const [third] = expand_abbrev(handle_accents(vars.$THIRD[0]));
  let john = "";
  const keys = Object.keys(raw_abbrevs["1John"]).sort();
  for (const key of keys) {
    if (!/^\$FIRST/.test(key)) {
      continue;
    }
    john = key.replace(/^\$FIRST(?!\w)/, "");
    break;
  }
  if (!john) {
    console.log(
      "  Warning: no available John abbreviation for testing book ranges"
    );
    return [];
  }
  const out = [];
  const johns = expand_abbrev(handle_accents(john));
  out.push(`\tit("should handle book ranges (${lang})", () => {`);
  out.push(
    '\t\tp.set_options({book_alone_strategy: "full", book_range_strategy: "include"});'
  );
  const alreadys = {};
  johns.sort().forEach((abbrev) => {
    vars.$TO.forEach((to_regex) => {
      expand_abbrev(remove_exclamations(handle_accents(to_regex))).forEach(
        (to) => {
          const first_to_third = `${first} ${to} ${third} ${abbrev}`;
          if (alreadys[first_to_third]) {
            return;
          }
          out.push(
            `\t\texpect(p.parse("${first_to_third}").osis()).toEqual("1John.1-3John.1");`
          );
          alreadys[first_to_third] = 1;
        }
      );
    });
  });
  out.push("\t});");
  return out;
}

function add_boundary_tests() {
  return `\tit("should handle boundaries (${lang})", () => {
\t\tp.set_options({book_alone_strategy: "full"});
\t\texpect(p.parse("\\u2014Matt\\u2014").osis()).toEqual("Matt.1-Matt.28");
\t\texpect(p.parse("\\u201cMatt 1:1\\u201d").osis()).toEqual("Matt.1.1");
\t});`;
}

function get_abbrevs() {
  const fd = fs.openSync(`temp.corrections.txt`, "w");
  let has_corrections = 0;
  const out = {};
  const data = get_file_contents(`${dir}/${lang}/data.txt`);
  data.split("\n").forEach((line) => {
    if (/\t\s/.test(line) && /^[^*]/.test(line)) {
      console.log(`Tab followed by space: ${line}`);
    }
    if (/ [\t\n]/.test(line)) {
      console.log(`Space followed by tab/newline: ${line}`);
    }
    if (!/^[\w*]/.test(line)) {
      return;
    }
    if (/^\*/.test(line) && /[[?!]/.test(line)) {
      console.log(`Regex character in preferred: ${line}`);
    }
    if (!/\t/.test(line)) {
      return;
    }
    const prev = line;
    line = line.normalize("NFD").normalize("NFC");
    if (line !== prev) {
      console.log("Non-normalized text");
      has_corrections = 1;
      fs.writeSync(fd, `${line}\n`);
    }
    const is_literal = /^\*/.test(line) ? 1 : 0;
    if (is_literal) {
      line = line.replace(/([\u0080-\uffff])/g, "$1`");
    }
    const [almost_osis, ...abbrevs] = line.split("\t");
    const osis = almost_osis.replace(/^\*/, "");
    is_valid_osis(osis);
    if (
      !/,/.test(osis) &&
      (!vars.$FORCE_OSIS_ABBREV || vars.$FORCE_OSIS_ABBREV[0] !== "false")
    ) {
      out[osis] = {
        ...out[osis],
        [osis]: 1,
      };
    }
    abbrevs.forEach((abbrev) => {
      if (!abbrev.length) {
        return;
      }
      if (!is_literal) {
        if (vars.$PRE_BOOK) {
          abbrev = `${vars.$PRE_BOOK[0]}${abbrev}`;
        }
        if (vars.$POST_BOOK) {
          abbrev += vars.$POST_BOOK[0];
        }
        raw_abbrevs[osis] = {
          ...raw_abbrevs[osis],
          [abbrev]: 1,
        };
      }
      abbrev = handle_accents(abbrev);
      const alts = expand_abbrev_vars(abbrev);
      if (/.\$/.test(alts)) {
        throw new Error(`Alts:${alts}`);
      }
      alts.forEach((alt) => {
        if (/[[?]/.test(alt)) {
          expand_abbrev(alt).forEach((expanded) => {
            out[osis] = {
              ...out[osis],
              [expanded]: 1,
            };
          });
        } else {
          out[osis] = {
            ...out[osis],
            [alt]: 1,
          };
        }
      });
    });
  });
  if (!has_corrections) {
    fs.rmSync("temp.corrections.txt");
  }
  return out;
}

function expand_abbrev_vars(abbrev) {
  abbrev = abbrev.replace(/\\(?![()[\]|s])/g, "");
  if (!/\$[A-Z]+/.test(abbrev)) {
    return [abbrev];
  }
  const variable = abbrev.match(/(\$[A-Z]+)(?!\w)/)[1];
  let out = [];
  let recurse = 0;
  vars[variable].forEach((value) => {
    expand_abbrev(value).forEach((val) => {
      val = handle_accents(val);
      let temp = abbrev;
      temp = temp.replace(/\$[A-Z]+(?!\w)/, val);
      if (/\$/.test(temp)) {
        recurse = 1;
      }
      out.push(temp);
      if (
        /^\$(?:FIRST|SECOND|THIRD|FOURTH|FIFTH)$/.test(variable) &&
        /^\d|^[IV]+$/.test(val)
      ) {
        let temp2 = abbrev;
        const safe = quote_meta(variable);
        temp2 = temp2.replace(new RegExp(`${safe}([^.]|$)`), `${val}.$1`);
        out.push(temp2);
      }
    });
  });
  if (recurse) {
    let temps = [];
    out.forEach((abbrev) => {
      const adds = expand_abbrev_vars(abbrev);
      temps = temps.concat(adds);
    });
    out = temps;
  }
  return out;
}

function get_order() {
  const out = [];
  const data = get_file_contents(`${dir}/${lang}/data.txt`);
  data.split("\n").forEach((line) => {
    if (!/^=/.test(line)) {
      return;
    }
    line = line.normalize("NFD").normalize("NFC");
    line = line.replace(/^=/, "");
    is_valid_osis(line);
    const apocrypha = valid_osises[line] === "apocrypha" ? 1 : 0;
    out.push({ osis: line, apocrypha });
    abbrevs[line] = {
      ...abbrevs[line],
      [line]: 1,
    };
    raw_abbrevs[line] = {
      ...raw_abbrevs[line],
      [line]: 1,
    };
  });
  return out;
}

function get_vars() {
  const out = {};
  const data = get_file_contents(`${dir}/${lang}/data.txt`);
  data.split("\n").forEach((line) => {
    if (!/^\$/.test(line)) {
      return;
    }
    line = line.normalize("NFD").normalize("NFC");
    const [key, ...values] = line.split("\t");
    if (!values) {
      throw new Error(`No values for ${key}`);
    }
    out[key] = values;
  });
  out.$ALLOWED_CHARACTERS?.forEach((char) => {
    const check = quote_meta(char);
    if (!new RegExp(`${check}`).test(valid_characters)) {
      valid_characters = valid_characters.replace(/\]$/, char);
    }
  });
  letters = get_pre_book_characters(out.$UNICODE_BLOCK, "");
  if (!out.$PRE_BOOK_ALLOWED_CHARACTERS) {
    out.$PRE_BOOK_ALLOWED_CHARACTERS = [letters];
  }
  if (!out.$POST_BOOK_ALLOWED_CHARACTERS) {
    out.$POST_BOOK_ALLOWED_CHARACTERS = [valid_characters];
  }
  if (!out.$PRE_PASSAGE_ALLOWED_CHARACTERS) {
    out.$PRE_PASSAGE_ALLOWED_CHARACTERS = [
      get_pre_passage_characters(out.$PRE_BOOK_ALLOWED_CHARACTERS),
    ];
  }
  out.$LANG = [lang];
  if (!out.$LANG_ISOS) {
    out.$LANG_ISOS = [lang];
  }
  return out;
}

function get_pre_passage_characters(allowed_chars) {
  let pattern = allowed_chars.join("|");
  if (/^\[\^[^\]]+?\]$/.test(pattern)) {
    pattern = pattern.replace(/`/g, "");
    pattern = pattern.replace(/\\x1[ef]|0-9|\\d|A-Z|a-z/g, "");
    pattern = pattern.replace(/\[\^/, "[^\\x1f\\x1e\\dA-Za-z");
  } else if (pattern === "\\d|\\b") {
    pattern = "[^w\x1f\x1e]";
  } else {
    throw new Error(`Unknown pre_passage pattern: ${pattern}`);
  }
  return pattern;
}

function get_pre_book_characters(unicodes_ref) {
  if (!unicodes_ref.length) {
    throw new Error("No $UNICODE_BLOCK is set");
  }
  const blocks = get_unicode_blocks(unicodes_ref);
  const letters_array = get_letters(blocks);
  const out_array = [];
  letters_array.forEach((ref) => {
    const [start, end] = ref;
    out_array.push(end === start ? start : `${start}-${end}`);
  });
  let out = out_array.join("");
  out = out.replace(/([\u0080-\uffff])/g, "$1`");
  return `[^${out}]`;
}

function get_letters(blocks) {
  const out = {};
  const data = get_file_contents(`bin/letters/letters.txt`);
  data.split("\n").forEach((line) => {
    if (!/^\\u/.test(line)) {
      return;
    }
    line = line.replace(/\\u/g, "");
    line = line.replace(/\s*#.+$/, "");
    line = line.replace(/\s+/g, "");
    let [start, end = start] = line.split("-");
    [start, end] = [parseInt(start, 16), parseInt(end, 16)];
    blocks.forEach((ref) => {
      const [start_range, end_range] = ref;
      if (end >= start_range && start <= end_range) {
        for (let i = start; i <= end; i++) {
          if (i < start_range || i > end_range) {
            continue;
          }
          out[i] = 1;
        }
      }
    });
  });
  let prev = -2;
  const out_array = [];
  Object.keys(out)
    .map((key) => parseInt(key, 10))
    .forEach((pos) => {
      const cc = String.fromCharCode(pos);
      if (pos === prev + 1) {
        // continuously update the right side to get a good range (e.g. ["A", "Z"]).
        out_array[out_array.length - 1][1] = cc;
      } else {
        out_array.push([cc, cc]);
      }
      prev = pos;
    });
  return out_array;
}

function get_unicode_blocks(unicodes_ref) {
  let unicode = unicodes_ref.join("|");
  if (!/Basic_Latin/.test(unicode)) {
    unicode += "|Basic_Latin";
  }
  const out = [];
  const data = get_file_contents(`bin/letters/blocks.txt`);
  data.split("\n").forEach((line) => {
    if (!/^\w/.test(line)) {
      return;
    }
    const [block, range] = line.split("\t");
    if (!new RegExp(unicode).test(block)) {
      return;
    }
    const range_hex = range.replace(/\\u/g, "");
    const [start, end] = range_hex.split("-");
    out.push([parseInt(start, 16), parseInt(end, 16)]);
  });
  return out;
}

function expand_abbrev(abbrev) {
  if (!/[[(?|\\]/.test(abbrev)) {
    return [abbrev];
  }
  abbrev = abbrev.replace(/(<!\\)\./g, "\\.");
  let chars = abbrev.split("");
  let outs = [""];
  while (chars.length !== 0) {
    let char = chars.shift();
    let is_optional = 0;
    if (char === "[") {
      const nexts = [];
      while (chars.length !== 0) {
        const next = chars.shift();
        if (next === "]") {
          break;
        } else if (next === "\\") {
          continue;
        } else {
          let accents = handle_accent(next);
          accents = accents.replace(/^\[|\]$/g, "");
          accents.split("").forEach((accent) => {
            nexts.push(accent);
          });
        }
      }

      [is_optional, chars] = is_next_char_optional(chars);
      if (is_optional) {
        nexts.push("");
      }
      const temps = [];
      outs.forEach((out) => {
        const alreadys = {};
        nexts.forEach((next) => {
          if (alreadys[next]) {
            return;
          }
          temps.push(`${out}${next}`);
          alreadys[next] = 1;
        });
      });
      outs = temps;
    } else if (char === "(") {
      let nexts = [];
      while (chars.length !== 0) {
        const next = chars.shift();
        if (!nexts.length && next === "?" && chars[0] === ":") {
          throw new Error("'(?:' in parentheses; replace with just '('");
          // chars.shift();
          // continue;
        }
        if (next === ")") {
          break;
        } else if (next === "\\") {
          nexts.push(next);
          nexts.push(chars.shift());
        } else {
          nexts.push(next);
        }
      }
      nexts = expand_abbrev(nexts.join(""));
      [is_optional, chars] = is_next_char_optional(chars);
      if (is_optional) {
        nexts.push("");
      }
      const temps = [];
      outs.forEach((out) => {
        nexts.forEach((next) => {
          temps.push(`${out}${next}`);
        });
      });
      outs = temps;
    } else if (char === "|") {
      outs.push(expand_abbrev(chars.join("")));
      return outs;
    } else {
      const temps = [];
      if (char === "\\") {
        // Just use the next character
        char = chars.shift();
      }
      [is_optional, chars] = is_next_char_optional(chars);
      outs.forEach((out) => {
        temps.push(`${out}${char}`);
        if (is_optional) {
          temps.push(out);
        }
      });
      outs = temps;
    }
  }
  if (/[[\]]/.test(outs.join(""))) {
    console.log(`Unexpected char: ${outs}`);
    process.exit();
  }
  return outs;
}

function is_next_char_optional(chars) {
  if (!chars) {
    return [0, chars];
  }
  let is_optional = 0;
  if (chars[0] === "?") {
    chars.shift();
    is_optional = 1;
  }
  return [is_optional, chars];
}

function handle_accents(text) {
  const chars = text.split("");
  const texts = [];
  let context = "";
  while (chars.length !== 0) {
    let char = chars.shift();
    if (/^[\u0080-\uffff]$/.test(char)) {
      if (chars && chars[0] === "`") {
        texts.push(char);
        texts.push(chars.shift());
        continue;
      }
      char = handle_accent(char);
      if (context === "[") {
        char = char.replace(/^\[|\]$/g, "");
      }
    } else if (chars && chars[0] === "`") {
      texts.push(char);
      texts.push(chars.shift());
      continue;
    } else if (char === "[" && !(texts && texts[texts.length - 1] === "\\")) {
      context = "[";
    } else if (char === "]" && !(texts && texts[texts.length - 1] === "\\")) {
      context = "";
    }
    texts.push(char);
  }

  text = texts.join("");
  text = text.replace(/'/g, "[\u2019']");
  if (
    !vars.$COLLAPSE_COMBINING_CHARACTERS ||
    vars.$COLLAPSE_COMBINING_CHARACTERS[0] !== "false"
  ) {
    text = text.replace(/\u02c8(?!`)/g, "[\u02c8']");
  }
  text = text.replace(/([\u0080-\uffff])`/g, "$1");
  text = text.replace(/[\u02b9\u0374]/g, "['\u2019\u0384\u0374\u02b9]");
  text = text.replace(
    /([\u0300\u0370]-)\['\u2019\u0384\u0374\u02b9\](\u0376)/,
    "$1\u0374$2"
  );
  text = text.replace(/\.(?!`)/g, "\\.?");
  text = text.replace(/\.`/g, "\\.");
  text = text.replace(/ `/g, "\u2009");
  return text;
}

function remove_exclamations(text) {
  return text.includes("!") ? text.split("!")[0] : text;
}

function handle_accent(char) {
  let alt = char.normalize("NFD");
  if (
    !vars.$COLLAPSE_COMBINING_CHARACTERS ||
    vars.$COLLAPSE_COMBINING_CHARACTERS[0] !== "false"
  ) {
    // remove combining characters
    alt = alt.replace(/\p{M}/gu, "");
  }
  alt = alt.normalize("NFC");
  if (char !== alt && alt.length > 0 && /[^\s\d]/.test(alt)) {
    return `[${char}${alt}]`;
  }
  char = char.replace(
    /[\u{0660}\u{06f0}\u{07c0}\u{0966}\u{09e6}\u{0a66}\u{0ae6}\u{0b66}\u{0be6}\u{0c66}\u{0ce6}\u{0d66}\u{0e50}\u{0ed0}\u{0f20}\u{1040}\u{1090}\u{17e0}\u{1810}\u{1946}\u{19d0}\u{1a80}\u{1a90}\u{1b50}\u{1bb0}\u{1c40}\u{1c50}\u{a620}\u{a8d0}\u{a900}\u{a9d0}\u{aa50}\u{abf0}\u{ff10}]/gu,
    `[${char}0]`
  );
  char = char.replace(
    /[\u{0661}\u{06f1}\u{07c1}\u{0967}\u{09e7}\u{0a67}\u{0ae7}\u{0b67}\u{0be7}\u{0c67}\u{0ce7}\u{0d67}\u{0e51}\u{0ed1}\u{0f21}\u{1041}\u{1091}\u{17e1}\u{1811}\u{1947}\u{19d1}\u{1a81}\u{1a91}\u{1b51}\u{1bb1}\u{1c41}\u{1c51}\u{a621}\u{a8d1}\u{a901}\u{a9d1}\u{aa51}\u{abf1}\u{ff11}]/gu,
    `[${char}1]`
  );
  char = char.replace(
    /[\u{0662}\u{06f2}\u{07c2}\u{0968}\u{09e8}\u{0a68}\u{0ae8}\u{0b68}\u{0be8}\u{0c68}\u{0ce8}\u{0d68}\u{0e52}\u{0ed2}\u{0f22}\u{1042}\u{1092}\u{17e2}\u{1812}\u{1948}\u{19d2}\u{1a82}\u{1a92}\u{1b52}\u{1bb2}\u{1c42}\u{1c52}\u{a622}\u{a8d2}\u{a902}\u{a9d2}\u{aa52}\u{abf2}\u{ff12}]/gu,
    `[${char}2]`
  );
  char = char.replace(
    /[\u{0663}\u{06f3}\u{07c3}\u{0969}\u{09e9}\u{0a69}\u{0ae9}\u{0b69}\u{0be9}\u{0c69}\u{0ce9}\u{0d69}\u{0e53}\u{0ed3}\u{0f23}\u{1043}\u{1093}\u{17e3}\u{1813}\u{1949}\u{19d3}\u{1a83}\u{1a93}\u{1b53}\u{1bb3}\u{1c43}\u{1c53}\u{a623}\u{a8d3}\u{a903}\u{a9d3}\u{aa53}\u{abf3}\u{ff13}]/gu,
    `[${char}3]`
  );
  char = char.replace(
    /[\u{0664}\u{06f4}\u{07c4}\u{096a}\u{09ea}\u{0a6a}\u{0aea}\u{0b6a}\u{0bea}\u{0c6a}\u{0cea}\u{0d6a}\u{0e54}\u{0ed4}\u{0f24}\u{1044}\u{1094}\u{17e4}\u{1814}\u{194a}\u{19d4}\u{1a84}\u{1a94}\u{1b54}\u{1bb4}\u{1c44}\u{1c54}\u{a624}\u{a8d4}\u{a904}\u{a9d4}\u{aa54}\u{abf4}\u{ff14}]/gu,
    `[${char}4]`
  );
  char = char.replace(
    /[\u{0665}\u{06f5}\u{07c5}\u{096b}\u{09eb}\u{0a6b}\u{0aeb}\u{0b6b}\u{0beb}\u{0c6b}\u{0ceb}\u{0d6b}\u{0e55}\u{0ed5}\u{0f25}\u{1045}\u{1095}\u{17e5}\u{1815}\u{194b}\u{19d5}\u{1a85}\u{1a95}\u{1b55}\u{1bb5}\u{1c45}\u{1c55}\u{a625}\u{a8d5}\u{a905}\u{a9d5}\u{aa55}\u{abf5}\u{ff15}]/gu,
    `[${char}5]`
  );
  char = char.replace(
    /[\u{0666}\u{06f6}\u{07c6}\u{096c}\u{09ec}\u{0a6c}\u{0aec}\u{0b6c}\u{0bec}\u{0c6c}\u{0cec}\u{0d6c}\u{0e56}\u{0ed6}\u{0f26}\u{1046}\u{1096}\u{17e6}\u{1816}\u{194c}\u{19d6}\u{1a86}\u{1a96}\u{1b56}\u{1bb6}\u{1c46}\u{1c56}\u{a626}\u{a8d6}\u{a906}\u{a9d6}\u{aa56}\u{abf6}\u{ff16}]/gu,
    `[${char}6]`
  );
  char = char.replace(
    /[\u{0667}\u{06f7}\u{07c7}\u{096d}\u{09ed}\u{0a6d}\u{0aed}\u{0b6d}\u{0bed}\u{0c6d}\u{0ced}\u{0d6d}\u{0e57}\u{0ed7}\u{0f27}\u{1047}\u{1097}\u{17e7}\u{1817}\u{194d}\u{19d7}\u{1a87}\u{1a97}\u{1b57}\u{1bb7}\u{1c47}\u{1c57}\u{a627}\u{a8d7}\u{a907}\u{a9d7}\u{aa57}\u{abf7}\u{ff17}]/gu,
    `[${char}7]`
  );
  char = char.replace(
    /[\u{0668}\u{06f8}\u{07c8}\u{096e}\u{09ee}\u{0a6e}\u{0aee}\u{0b6e}\u{0bee}\u{0c6e}\u{0cee}\u{0d6e}\u{0e58}\u{0ed8}\u{0f28}\u{1048}\u{1098}\u{17e8}\u{1818}\u{194e}\u{19d8}\u{1a88}\u{1a98}\u{1b58}\u{1bb8}\u{1c48}\u{1c58}\u{a628}\u{a8d8}\u{a908}\u{a9d8}\u{aa58}\u{abf8}\u{ff18}]/gu,
    `[${char}8]`
  );
  char = char.replace(
    /[\u{0669}\u{06f9}\u{07c9}\u{096f}\u{09ef}\u{0a6f}\u{0aef}\u{0b6f}\u{0bef}\u{0c6f}\u{0cef}\u{0d6f}\u{0e59}\u{0ed9}\u{0f29}\u{1049}\u{1099}\u{17e9}\u{1819}\u{194f}\u{19d9}\u{1a89}\u{1a99}\u{1b59}\u{1bb9}\u{1c49}\u{1c59}\u{a629}\u{a8d9}\u{a909}\u{a9d9}\u{aa59}\u{abf9}\u{ff19}]/gu,
    `[${char}9]`
  );
  return char;
}

function is_valid_osis(osis) {
  osis.split(",").forEach((part) => {
    if (!valid_osises[part]) {
      throw new Error(`Invalid OSIS: ${osis} (${part})`);
    }
  });
}

function make_valid_osises(osises) {
  let type = "ot_nt";
  return osises.reduce((out, osis) => {
    if (osis === "Tob") {
      type = "apocrypha";
    }
    out[osis] = type;
    return out;
  }, {});
}

function uc_normalize(text) {
  return text.normalize("NFD").toUpperCase().normalize("NFC");
}

function get_file_contents(filename) {
  return fs.readFileSync(filename).toString();
}

function quote_meta(str) {
  return str.replace(/[[\]{}()*+?.,\\^$|#]/g, "\\$&");
}
