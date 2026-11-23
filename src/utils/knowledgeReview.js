export const reviewIntervals = [1, 3, 7, 14]

export function getDueReviewCards(cards, today) {
  return cards.filter((card) => {
    const createdDate = getKnowledgeCardCreatedDate(card)
    if (!createdDate) return false
    const daysSinceCreated = diffDays(createdDate, today)
    return reviewIntervals.includes(daysSinceCreated) && !hasKnowledgeCardReviewToday(card, today)
  })
}

export function getKnowledgeCardCreatedDate(card) {
  return (card.createdAt || card.createdDate || card.date || card.reviewDate || '').slice(0, 10)
}

export function hasKnowledgeCardReviewToday(card, today) {
  return Array.isArray(card.reviewRecords) && card.reviewRecords.some((record) => {
    const date = typeof record === 'string' ? record : record?.date
    return date === today
  })
}

export function markKnowledgeCardReviewedToday(cardId, today, setKnowledgeCards) {
  setKnowledgeCards((cards) =>
    cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            reviewRecords: [
              ...(Array.isArray(card.reviewRecords) ? card.reviewRecords : []),
              { date: today, reviewedAt: new Date().toISOString() },
            ],
          }
        : card,
    ),
  )
}

export function diffDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  return Math.round((end - start) / 86400000)
}
