import { bcv_parser } from "../core";

bcv_parser.prototype.regexps.space = "[\\s\\xa0]";
/*
 * - Line 1		- Beginning of string or not in the middle of a word or immediately following another book. Only count a book if it's part of a sequence: `Matt5John3` is OK, but not `1Matt5John3`
 * - Lines 3-13	- inverted book/chapter (cb)
 * - Line 11	- no plurals here since it's a single chapter
 * - Line 14	- book
 * - Line 16	- special Psalm chapters
 * - Line 18	- could be followed by a number
 * - Line 20	- a-e allows 1:1a
 * - Line 21	- or the end of the string
 */
bcv_parser.prototype.regexps.escaped_passage = new RegExp(`\
(?:^|[^\\x1f\\x1e\\dA-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])\
(\
(?:\
(?:ch(?:apters?|a?pts?\\.?|a?p?s?\\.?)?\\s*\
\\d+\\s*(?:[\\u2013\\u2014\\-]|through|thru|to)\\s*\\d+\\s*\
(?:from|of|in)(?:\\s+the\\s+book\\s+of)?\\s*)\
|(?:ch(?:apters?|a?pts?\\.?|a?p?s?\\.?)?\\s*\
\\d+\\s*\
(?:from|of|in)(?:\\s+the\\s+book\\s+of)?\\s*)\
|(?:\\d+(?:th|nd|st)\\s*\
ch(?:apter|a?pt\\.?|a?p?\\.?)?\\s*\
(?:from|of|in)(?:\\s+the\\s+book\\s+of)?\\s*)\
)?\
\\x1f(\\d+)(?:/\\d+)?\\x1f\
(?:\
/\\d+\\x1f\
|[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014]\
|titul(?![a-z])\
|kapitola|kapitoly|ver[šs]e|kapitol|kap|srv|ff|-|a\
|[a-e](?!\\w)\
|$\
)+\
)`, "gi");
// These are the only valid ways to end a potential passage match. The closing parenthesis allows for fully capturing parentheses surrounding translations (ESV**)**. The last one, `[\d\x1f]` needs not to be +; otherwise `Gen5ff` becomes `\x1f0\x1f5ff`, and `adjust_regexp_end` matches the `\x1f5` and incorrectly dangles the ff.
// 'ff09' is a full-width closing parenthesis.
bcv_parser.prototype.regexps.match_end_split = new RegExp(`\
\\d\\W*titul\
|\\d\\W*ff(?:[\\s\\xa0*]*\\.)?\
|\\d[\\s\\xa0*]*[a-e](?!\\w)\
|\\x1e(?:[\\s\\xa0*]*[)\\]\\uff09])?\
|[\\d\\x1f]`, "gi");
bcv_parser.prototype.regexps.control = /[\x1e\x1f]/g;
bcv_parser.prototype.regexps.pre_book = "[^A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ]";

bcv_parser.prototype.regexps.first = `(?:Prvn[íi]|1|I)\\.?${bcv_parser.prototype.regexps.space}*`;
bcv_parser.prototype.regexps.second = `(?:Druh[áa]|Druh[ýy]|2|II)\\.?${bcv_parser.prototype.regexps.space}*`;
bcv_parser.prototype.regexps.third = `(?:T[řr]et[íi]|3|III)\\.?${bcv_parser.prototype.regexps.space}*`;
bcv_parser.prototype.regexps.range_and = `(?:[&\u2013\u2014-]|(?:a|srv)|-)`;
bcv_parser.prototype.regexps.range_only = "(?:[\u2013\u2014-]|-)";
// Each book regexp should return two parenthesized objects: an optional preliminary character and the book itself.
bcv_parser.prototype.regexps.get_books = (include_apocrypha: boolean, case_sensitive: string) => {
	const books = [
		{
			osis: ["Ps"],
			apocrypha: true,
			extra: "2",
			/*
			 * - Don't match a preceding \d like usual because we only want to match a valid OSIS, which will never have a preceding digit.
			 * - Always followed by ".1"; the regular Psalms parser can handle `Ps151` on its own.
			 * - Case-sensitive because we only want to match a valid OSIS.
			 */
			regexp: /(\b)(Ps151)(?=\.1)/g
		},
		{
			osis: ["Gen"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Prvn[i\\xED][\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|[1I]\\.[\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|[1I][\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|G(?:enesis|en|n)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Exod"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Druh[ay\\xE1\\xFD][\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|(?:II|2)\\.[\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|(?:II|2)[\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|Ex(?:odus|od)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Bel"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:B[e\\xE9]l(?:[\\s\\xa0]*a[\\s\\xa0]*drak)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Lev"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:T[rř]et[i\\xED][\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|(?:III|3)\\.[\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|(?:III|3)[\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|L(?:eviti(?:cusi|kus)|ev(?:iticus)?|v)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Num"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:[CČ]tvrt[a\\xE1][\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|(?:IV|4)\\.[\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|(?:IV|4)[\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|Nu(?:meri|m)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Sir"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Kniha[\\s\\xa0]*S[i\\xED]rachovcova|Ecclesiasticus|S[i\\xED]rachovec|S[i\\xED]r))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Wis"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:M(?:oudrost(?:[\\s\\xa0]*[SŠ]alomounova)?|dr)|Kniha[\\s\\xa0]*(?:moudrost[i\\xED]|Moudrosti)|Wis))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Lam"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Pl(?:[a\\xE1][cč][\\s\\xa0]*Jerem[ij][a\\xE1][sš][uů]v)?|Kniha[\\s\\xa0]*n[a\\xE1][rř]k[uů]|Lam)|(?:Pl[a\\xE1][cč]))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["EpJer"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:List[\\s\\xa0]*Jeremj[a\\xE1][sš][uů]v|EpJer))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Rev"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Zj(?:even(?:i(?:[\\s\\xa0]*(?:svat[e\\xE9]ho[\\s\\xa0]*Jana|Janovo))?|\\xED(?:[\\s\\xa0]*Janovo)?))?|Kniha[\\s\\xa0]*Zjeven[i\\xED]|Apokalypsa|Rev))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["PrMan"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Modlitbu[\\s\\xa0]*Manasse|PrMan))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Deut"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:P[a\\xE1]t[a\\xE1][\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|[5V]\\.[\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|[5V][\\s\\xa0]*(?:kniha[\\s\\xa0]*Moj[zž][i\\xED][sš]|Moj[zž][i\\xED][sš])ova|D(?:euteronomium|eut|t)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Josh"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:J(?:o(?:z(?:ue)?|sh)|z)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Judg"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:S(?:oudc[uů]|dc?)|Judg))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Ruth"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:R(?:uth?|\\xFA?t)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Esd"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Prvn[i\\xED][\\s\\xa0]*Ezdr[a\\xE1][sš]|[1I]\\.[\\s\\xa0]*Ezdr[a\\xE1][sš]|[1I][\\s\\xa0]*Ezdr[a\\xE1][sš]|1Esd))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Esd"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Druh[ay\\xE1\\xFD][\\s\\xa0]*Ezdr[a\\xE1][sš]|(?:II|2)\\.[\\s\\xa0]*Ezdr[a\\xE1][sš]|(?:II|2)[\\s\\xa0]*Ezdr[a\\xE1][sš]|2Esd))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Isa"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:I(?:z(?:a[ij][a\\xE1][sš])?|sa)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Sam"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Druh[ay\\xE1\\xFD][\\s\\xa0]*(?:kniha[\\s\\xa0]*Samuelova|S(?:amuelova|am(?:uel)?)?)|(?:II|2)\\.[\\s\\xa0]*(?:kniha[\\s\\xa0]*Samuelova|S(?:amuelova|am(?:uel)?)?)|(?:II|2)[\\s\\xa0]*(?:kniha[\\s\\xa0]*Samuelova|S(?:amuelova|am(?:uel)?)?)|2Sam))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Sam"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Prvn[i\\xED][\\s\\xa0]*(?:kniha[\\s\\xa0]*Samuelova|S(?:amuelova|am(?:uel)?)?)|[1I]\\.[\\s\\xa0]*(?:kniha[\\s\\xa0]*Samuelova|S(?:amuelova|am(?:uel)?)?)|[1I][\\s\\xa0]*(?:kniha[\\s\\xa0]*Samuelova|S(?:amuelova|am(?:uel)?)?)|1Sam))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Kgs"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Druh[ay\\xE1\\xFD][\\s\\xa0]*(?:kniha[\\s\\xa0]*kr[a\\xE1]lovsk[a\\xE1]|Kr(?:[a\\xE1]lovsk[a\\xE1]|[a\\xE1]l)?)|(?:II|2)\\.[\\s\\xa0]*(?:kniha[\\s\\xa0]*kr[a\\xE1]lovsk[a\\xE1]|Kr(?:[a\\xE1]lovsk[a\\xE1]|[a\\xE1]l)?)|(?:II|2)[\\s\\xa0]*(?:kniha[\\s\\xa0]*kr[a\\xE1]lovsk[a\\xE1]|Kr(?:[a\\xE1]lovsk[a\\xE1]|[a\\xE1]l)?)|2Kgs))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Kgs"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Prvn[i\\xED][\\s\\xa0]*(?:kniha[\\s\\xa0]*kr[a\\xE1]lovsk[a\\xE1]|Kr(?:[a\\xE1]lovsk[a\\xE1]|[a\\xE1]l)?)|[1I]\\.[\\s\\xa0]*(?:kniha[\\s\\xa0]*kr[a\\xE1]lovsk[a\\xE1]|Kr(?:[a\\xE1]lovsk[a\\xE1]|[a\\xE1]l)?)|[1I][\\s\\xa0]*(?:kniha[\\s\\xa0]*kr[a\\xE1]lovsk[a\\xE1]|Kr(?:[a\\xE1]lovsk[a\\xE1]|[a\\xE1]l)?)|1Kgs))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Chr"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Druh[ay\\xE1\\xFD][\\s\\xa0]*(?:Pa(?:ralipomenon)?|kniha[\\s\\xa0]*kronik|Letopis[uů]|Kronik)|(?:II|2)\\.[\\s\\xa0]*(?:Pa(?:ralipomenon)?|kniha[\\s\\xa0]*kronik|Letopis[uů]|Kronik)|(?:II|2)[\\s\\xa0]*(?:Pa(?:ralipomenon)?|kniha[\\s\\xa0]*kronik|Letopis[uů]|Kronik)|2Chr))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Chr"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Prvn[i\\xED][\\s\\xa0]*(?:Pa(?:ralipomenon)?|kniha[\\s\\xa0]*kronik|Letopis[uů]|Kronik)|[1I]\\.[\\s\\xa0]*(?:Pa(?:ralipomenon)?|kniha[\\s\\xa0]*kronik|Letopis[uů]|Kronik)|[1I][\\s\\xa0]*(?:Pa(?:ralipomenon)?|kniha[\\s\\xa0]*kronik|Letopis[uů]|Kronik)|1Chr))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Ezra"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Ez(?:d(?:r[a\\xE1][sš])?|ra)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Neh"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Neh(?:em[ij][a\\xE1][sš])?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["GkEsth"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Ester[\\s\\xa0]*(?:\\(řeck\\xE9[\\s\\xa0]*(?:dodatky|č\\xE1sti)\\)|[rř]eck[e\\xE9][\\s\\xa0]*(?:dodatky|[cč][a\\xE1]sti))|GkEsth))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Esth"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Est(?:er|h)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Job"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:J[o\\xF3]?b))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Ps"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Kniha[\\s\\xa0]*[zž]alm[uů]|[ZŽ]almy|[ZŽ](?:alm)?|Ps))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["PrAzar"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Azarj[a\\xE1][sš]ova[\\s\\xa0]*modlitba|PrAzar))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Prov"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:P(?:ř(?:[i\\xED]s(?:lov[i\\xED][\\s\\xa0]*[SŠ]alomounova)?)?|r(?:[i\\xED]s(?:lov[i\\xED][\\s\\xa0]*[SŠ]alomounova)?|ov)?))|(?:P[rř][i\\xED]slov[i\\xED]))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Eccl"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:K(?:ohelet|az(?:atel)?)|Eccl))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["SgThree"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:P[i\\xED]se[nň][\\s\\xa0]*ml[a\\xE1]denc[uů][\\s\\xa0]*v[\\s\\xa0]*ho[rř][i\\xED]c[i\\xED][\\s\\xa0]*peci|T[rř]i[\\s\\xa0]*mu[zž]i[\\s\\xa0]*v[\\s\\xa0]*rozp[a\\xE1]len[e\\xE9][\\s\\xa0]*peci|SgThree))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Song"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:P[i\\xED]s(?:e[nň][\\s\\xa0]*(?:[SŠ]alamounova|p[i\\xED]sn[i\\xED]))?|Song)|(?:P[i\\xED]se[nň]))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Jer"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:J(?:er(?:em[ij][a\\xE1][sš])?|r)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Ezek"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Ez(?:e(?:chiel|k))?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Dan"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Da(?:n(?:iel)?)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Hos"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Oz(?:e[a\\xE1][sš])?|Hos))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Joel"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:J(?:(?:\\xF3e)?l|o(?:el)?)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Amos"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:\\xC1mos|Am(?:os)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Obad"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Obad(?:j[a\\xE1][sš]|j[a\\xE1])?|Abd(?:i(?:j[a\\xE1][sš]|[a\\xE1][sš]))?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Jonah"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Jon(?:\\xE1[sš]|a[hsš])?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Mic"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Mi(?:c(?:h(?:[ae][a\\xE1][sš])?)?)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Nah"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Na(?:h(?:um)?)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Hab"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Ab(?:aku)?k|Hab))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Zeph"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:S(?:ofon[ij][a\\xE1][sš]|f)|Zeph))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Hag"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Ag(?:geus|eus)?|Hag))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Zech"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Z(?:a(?:char[ij][a\\xE1][sš])?|ech)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Mal"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Mal(?:achi[a\\xE1][sš])?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Matt"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Evangelium[\\s\\xa0]*podle[\\s\\xa0]*Matou[sš]e|M(?:at(?:ou[sš]ovo[\\s\\xa0]*evangelium|t)|at(?:ou[sš])?|t)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Mark"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Evangelium[\\s\\xa0]*podle[\\s\\xa0]*Marka|M(?:ar(?:kovo[\\s\\xa0]*evangelium|ek)|ark|k)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Luke"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Evangelium[\\s\\xa0]*podle[\\s\\xa0]*Luk[a\\xE1][sš]e|L(?:uk(?:[a\\xE1][sš]ovo[\\s\\xa0]*evangelium|e)|uk[a\\xE1][sš]|k)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1John"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:1John)|(?:Prvn[i\\xED][\\s\\xa0]*(?:list[\\s\\xa0]*Jan[uů]v|J(?:anova|an[uů]v|an)?)|[1I]\\.[\\s\\xa0]*(?:list[\\s\\xa0]*Jan[uů]v|J(?:anova|an[uů]v|an)?)|[1I][\\s\\xa0]*(?:list[\\s\\xa0]*Jan[uů]v|J(?:anova|an[uů]v|an)?)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2John"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:2John)|(?:Druh[ay\\xE1\\xFD][\\s\\xa0]*(?:list[\\s\\xa0]*Jan[uů]v|J(?:anova|an[uů]v|an)?)|(?:II|2)\\.[\\s\\xa0]*(?:list[\\s\\xa0]*Jan[uů]v|J(?:anova|an[uů]v|an)?)|(?:II|2)[\\s\\xa0]*(?:list[\\s\\xa0]*Jan[uů]v|J(?:anova|an[uů]v|an)?)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["3John"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:3John)|(?:T[rř]et[i\\xED][\\s\\xa0]*(?:list[\\s\\xa0]*Jan[uů]v|J(?:anova|an[uů]v|an)?)|(?:III|3)\\.[\\s\\xa0]*(?:list[\\s\\xa0]*Jan[uů]v|J(?:anova|an[uů]v|an)?)|(?:III|3)[\\s\\xa0]*(?:list[\\s\\xa0]*Jan[uů]v|J(?:anova|an[uů]v|an)?)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["John"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Evangelium[\\s\\xa0]*podle[\\s\\xa0]*Jana|J(?:anovo[\\s\\xa0]*evangelium|ohn|an)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Acts"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Sk(?:utky(?:[\\s\\xa0]*apo[sš]tol(?:sk[e\\xE9]|[u\\xFCů]))?)?|Acts))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Rom"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:List[\\s\\xa0]*[RŘ][i\\xED]man[uů]m|(?:Ř[i\\xED]|R[io\\xED])m|[RŘ])|(?:[RŘ][i\\xED]man[uů]m))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Cor"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Druh[ay\\xE1\\xFD](?:[\\s\\xa0]*(?:list[\\s\\xa0]*Korin(?:tsk[y\\xFD]|sk[y\\xFD])m|K(?:orintsk[y\\xFD]m)?)|K)|(?:II|2)\\.(?:[\\s\\xa0]*(?:list[\\s\\xa0]*Korin(?:tsk[y\\xFD]|sk[y\\xFD])m|K(?:orintsk[y\\xFD]m)?)|K)|II[\\s\\xa0]*(?:list[\\s\\xa0]*Korin(?:tsk[y\\xFD]|sk[y\\xFD])m|K(?:orintsk[y\\xFD]m)?)|2[\\s\\xa0]*list[\\s\\xa0]*Korin(?:tsk[y\\xFD]|sk[y\\xFD])m|2[\\s\\xa0]*Korintsk[y\\xFD]m|2(?:[\\s\\xa0]*K(?:or)?|K)|2[CK]or|IIK))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Cor"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Prvn[i\\xED](?:[\\s\\xa0]*(?:list[\\s\\xa0]*Korin(?:tsk[y\\xFD]|sk[y\\xFD])m|K(?:orintsk[y\\xFD]m|or)?)|K)|[1I]\\.(?:[\\s\\xa0]*(?:list[\\s\\xa0]*Korin(?:tsk[y\\xFD]|sk[y\\xFD])m|K(?:orintsk[y\\xFD]m|or)?)|K)|[1I][\\s\\xa0]*(?:list[\\s\\xa0]*Korin(?:tsk[y\\xFD]|sk[y\\xFD])m|K(?:orintsk[y\\xFD]m|or)?)|1(?:Cor|K)|IK))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Gal"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:List[\\s\\xa0]*Galatsk[y\\xFD]m|Ga(?:latsk[y\\xFD]m|l)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Eph"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:List[\\s\\xa0]*Ef(?:\\xE9zsk[y\\xFD]|ez(?:sk[y\\xFD]|an[uů]))m|E(?:fez?sk[y\\xFD]m|ph|f)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Phil"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:List[\\s\\xa0]*Filipsk[y\\xFD]m|Filipensk[y\\xFD]m|Filipsk[y\\xFD]m|Phil|Fp))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Col"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:List[\\s\\xa0]*Kolos(?:an[uů]|k[y\\xFD])m|Kolos(?:sens|ens)?k[y\\xFD]m|Kolosan[uů]m|Kol?|Col))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Thess"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Druh[ay\\xE1\\xFD][\\s\\xa0]*(?:list[\\s\\xa0]*(?:Tesalonick[y\\xFD]|Solu[nň]sk[y\\xFD])m|(?:Tessalonicen|Solu[nň])sk[y\\xFD]m|Tesalonick[y\\xFD]m|Sol|Te)|(?:II|2)\\.[\\s\\xa0]*(?:list[\\s\\xa0]*(?:Tesalonick[y\\xFD]|Solu[nň]sk[y\\xFD])m|(?:Tessalonicen|Solu[nň])sk[y\\xFD]m|Tesalonick[y\\xFD]m|Sol|Te)|(?:II|2)[\\s\\xa0]*(?:list[\\s\\xa0]*(?:Tesalonick[y\\xFD]|Solu[nň]sk[y\\xFD])m|(?:Tessalonicen|Solu[nň])sk[y\\xFD]m|Tesalonick[y\\xFD]m|Sol|Te)|2Thess))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Thess"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Prvn[i\\xED][\\s\\xa0]*(?:list[\\s\\xa0]*(?:Tesalonick[y\\xFD]|Solu[nň]sk[y\\xFD])m|(?:Tessalonicen|Solu[nň])sk[y\\xFD]m|Tesalonick[y\\xFD]m|Sol|Te)|[1I]\\.[\\s\\xa0]*(?:list[\\s\\xa0]*(?:Tesalonick[y\\xFD]|Solu[nň]sk[y\\xFD])m|(?:Tessalonicen|Solu[nň])sk[y\\xFD]m|Tesalonick[y\\xFD]m|Sol|Te)|[1I][\\s\\xa0]*(?:list[\\s\\xa0]*(?:Tesalonick[y\\xFD]|Solu[nň]sk[y\\xFD])m|(?:Tessalonicen|Solu[nň])sk[y\\xFD]m|Tesalonick[y\\xFD]m|Sol|Te)|1Thess))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Tim"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Druh[ay\\xE1\\xFD][\\s\\xa0]*(?:list[\\s\\xa0]*Tim(?:otej?|etej)ovi|T(?:imotejovi|imoteovi|imoteus|im|m))|(?:II|2)\\.[\\s\\xa0]*(?:list[\\s\\xa0]*Tim(?:otej?|etej)ovi|T(?:imotejovi|imoteovi|imoteus|im|m))|(?:II|2)[\\s\\xa0]*(?:list[\\s\\xa0]*Tim(?:otej?|etej)ovi|T(?:imotejovi|imoteovi|imoteus|im|m))|2Tim))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Tim"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Prvn[i\\xED][\\s\\xa0]*(?:list[\\s\\xa0]*Tim(?:otej?|ete)ovi|T(?:imotejovi|imoteovi|imoteus|im|m))|[1I]\\.[\\s\\xa0]*(?:list[\\s\\xa0]*Tim(?:otej?|ete)ovi|T(?:imotejovi|imoteovi|imoteus|im|m))|[1I][\\s\\xa0]*(?:list[\\s\\xa0]*Tim(?:otej?|ete)ovi|T(?:imotejovi|imoteovi|imoteus|im|m))|1Tim))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Titus"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:List[\\s\\xa0]*Titovi|T(?:itovi|itus|it|t)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Phlm"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:List[\\s\\xa0]*Filemonovi|Filemonovi|Filemon|(?:Phl|Fl?)m))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Heb"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:List[\\s\\xa0]*(?:Hebrej[uů]|[ZŽ]id[uů])m|Hebrej[uů]m|[ZŽ]id[uů]m|Heb|[ZŽ]d))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Jas"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:List[\\s\\xa0]*Jakub[uů]v|J(?:akub[uů]v|ak(?:ub)?|as|k)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Pet"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:2Pet)|(?:Druh[ay\\xE1\\xFD][\\s\\xa0]*(?:list[\\s\\xa0]*Petr[uů]v|P(?:etrova|etr[uů]v|etr|t)?)|(?:II|2)\\.[\\s\\xa0]*(?:list[\\s\\xa0]*Petr[uů]v|P(?:etrova|etr[uů]v|etr|t)?)|(?:II|2)[\\s\\xa0]*(?:list[\\s\\xa0]*Petr[uů]v|P(?:etrova|etr[uů]v|etr|t)?)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Pet"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:1Pet)|(?:Prvn[i\\xED][\\s\\xa0]*(?:list[\\s\\xa0]*Petr[uů]v|P(?:etrova|etr[uů]v|etr|t)?)|[1I]\\.[\\s\\xa0]*(?:list[\\s\\xa0]*Petr[uů]v|P(?:etrova|etr[uů]v|etr|t)?)|[1I][\\s\\xa0]*(?:list[\\s\\xa0]*Petr[uů]v|P(?:etrova|etr[uů]v|etr|t)?)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Jude"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:List[\\s\\xa0]*Jud[uů]v|J(?:ud(?:ova|[ae])|ud[uů]v|u|d)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Tob"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:T(?:\\xF3bi(?:j[a\\xE1][sš]|t)|ob(?:i(?:j[a\\xE1][sš]|[a\\xE1][sš]|t))?)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Jdt"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:J(?:[u\\xFA]d(?:it)?|dt)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Bar"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Kniha[\\s\\xa0]*B[a\\xE1]ru(?:ch|k)ova|B(?:[a\\xE1]ru(?:ch|k)|[a\\xE1]r)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Sus"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Zuz(?:ana)?|Sus))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Macc"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Druh[ay\\xE1\\xFD][\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|(?:II|2)\\.[\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|(?:II|2)[\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|2Macc))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["3Macc"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:T[rř]et[i\\xED][\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|(?:III|3)\\.[\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|(?:III|3)[\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|3Macc))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["4Macc"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:[CČ]tvrt[a\\xE1][\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|(?:IV|4)\\.[\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|(?:IV|4)[\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|4Macc))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Macc"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏḀ-ỿⱠ-ⱿꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Prvn[i\\xED][\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|[1I]\\.[\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|[1I][\\s\\xa0]*Mak(?:abejsk[a\\xE1])?|1Macc))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
	];
	// Short-circuit the look if we know we want all the books.
	if ((include_apocrypha === true) && (case_sensitive === "none")) { return books; }
	// Filter out books in the Apocrypha if we don't want them. `Array.map` isn't supported below IE9.
	const out = [];
	for (const book of books) {
		if ((include_apocrypha === false) && (book.apocrypha != null) && (book.apocrypha === true)) { continue; }
		if (case_sensitive === "books") {
			book.regexp = new RegExp(book.regexp.source, "g");
		}
		out.push(book);
	}
	return out;
};

// Default to not using the Apocrypha
bcv_parser.prototype.regexps.books = bcv_parser.prototype.regexps.get_books(false, "none");
