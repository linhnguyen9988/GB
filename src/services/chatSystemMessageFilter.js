'use strict';

// Apply before ORDER BY/LIMIT/MAX so a notice cannot replace the last real
// message or consume one of the inbox's recent-message candidate slots.
const acceptedCard = '^[[:space:]]*[^[:cntrl:]]+ đã đồng ý kết bạn[.!]?[[:space:]]+https?://res-zalo[.]zadn[.]vn/upload/media/2019/10/11/artboard_5_4_x_2x_1570759790847_74009[.]png([?][^[:space:]]*)?[[:space:]]*$';
const aliasedFriend = '^[[:space:]]*Bạn vừa kết bạn với [^[:cntrl:]]+[·•|–-][[:space:]]*KH[0-9]{1,20}[.!]?[[:space:]]*$';
const conversationMessageSql = `(
    COALESCE(channel, 'facebook') <> 'zalo' OR (
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(template_json), template_json, '{}'), '$.template_type')), '') <> 'zalo_system'
        AND NOT (COALESCE(image, '') = '' AND COALESCE(template_json, '') IN ('', 'null') AND
            (COALESCE(message, '') REGEXP ? OR COALESCE(message, '') REGEXP ?))
    )
)`;

// Bind regexes as values. mysql2.query treats every literal '?' in the SQL
// text as a placeholder, including those inside already quoted regex strings.
const conversationMessageParams = [acceptedCard, aliasedFriend];

module.exports = { conversationMessageSql, conversationMessageParams };
