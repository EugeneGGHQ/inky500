import fs from 'fs'
import resultsData from '../data/results'
import standingsData from '../data/standings'
import seasonRacersData from '../data/seasonRacers'
import trackData from '../data/tracks.json'
import {
  type RacerResults,
  type TrackName,
  type SeasonName,
  type Tracks,
  type SeasonRacers,
  type RacerName,
  type ConstructorResult
} from '../types'

type GeneratedConstructorStandings = {
  [index: string]: ConstructorResult
}

type GeneratedRaceStandings = {
  [index: string]: number
}

type GeneratedStandings = {
  [index: string]: GeneratedRaceStandings | GeneratedConstructorStandings | null
}

const standardDriverCount = 2
const autoGeneratedSeasons = ['s4']
const topTenPoints = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
const topTwentyPoints = [35, 29, 24, 21, 19, 17, 15, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
const pointsScheme = { s1: topTenPoints, s2: topTenPoints, s3: topTenPoints, s4: topTwentyPoints }

const calculateStandings = (season: SeasonName) => {
  const seasonRaces = Object.keys(resultsData[season])

  // Compile initial race scores into standings objects
  const points = seasonRaces.reduce((racesObj: GeneratedStandings, race: string) => {
    const raceResults = (resultsData[season] as RacerResults)[race as TrackName]
    const noPointsRace = (trackData as Tracks)[race as TrackName].noPoints

    const points = raceResults
      ? Object.keys(raceResults.results).reduce(
          (obj: GeneratedRaceStandings, item: string, currentIndex) => {
            const cumulativePoints =
              (pointsScheme[season][currentIndex] ?? 0) +
              (raceResults.fastestLap.racerId === item ? 1 : 0)

            return (obj[item] = noPointsRace ? 0 : cumulativePoints), obj
          },
          {}
        )
      : null

    return (racesObj[race] = points), racesObj
  }, {})

  // Add the points for each driver cumulatively, and reorder
  const raceKeys = Object.keys(points)

  raceKeys.forEach((race, index) => {
    if (points[race] === null) {
      return
    }

    const racePoints = points[race] as GeneratedRaceStandings
    if (index > 0) {
      const previousRacePoints = points[raceKeys[index - 1]] as GeneratedRaceStandings
      Object.keys(racePoints).forEach((driver) => {
        racePoints[driver] += previousRacePoints[driver] ?? 0
      })
    }

    points[race] = Object.entries(racePoints)
      .sort(([, a], [, b]) => b - a)
      .reduce((r, [k, v]) => ({ ...r, [k]: v }), {})
  })

  return points
}

const calculateConstructors = (season: SeasonName) => {
  const seasonRaces = Object.keys(standingsData[season])

  // Compile initial race scores into standings objects
  const points = seasonRaces.reduce((racesObj: GeneratedStandings, race: string) => {
    const standings = (standingsData[season] as GeneratedRaceStandings)[race as TrackName]
    const noPointsRace = (trackData as Tracks)[race as TrackName].noPoints

    const points = standings
      ? Object.entries(standings).reduce((obj: GeneratedConstructorStandings, standing) => {
          const car = (seasonRacersData[season as SeasonName] as SeasonRacers)[
            standing[0] as RacerName
          ].car

          const driverCount = (obj[car]?.driverCount ?? 0) + 1
          const standardPoints = (obj[car]?.points ?? 0) + standing[1]

          return (
            (obj[car] = {
              points: noPointsRace ? 0 : standardPoints,
              normalisedPoints: noPointsRace ? 0 : standardPoints,
              driverCount
            }),
            obj
          )
        }, {})
      : null

    if (points) {
      Object.entries(points).map((constructor) => {
        points[constructor[0]].normalisedPoints = Math.round(
          constructor[1].points * (standardDriverCount / constructor[1].driverCount)
        )
      })
    }

    return (racesObj[race] = points), racesObj
  }, {})

  const raceKeys = Object.keys(points)

  raceKeys.forEach((race, index) => {
    if (points[race] === null) {
      return
    }

    const racePoints = points[race] as GeneratedConstructorStandings
    if (index > 0) {
      const previousRacePoints = points[raceKeys[index - 1]] as GeneratedConstructorStandings
      Object.keys(racePoints).forEach((driver) => {
        racePoints[driver] = {
          points: racePoints[driver].points + previousRacePoints[driver].points ?? 0,
          normalisedPoints:
            racePoints[driver].normalisedPoints + previousRacePoints[driver].normalisedPoints ?? 0,
          driverCount: racePoints[driver].driverCount
        }
      })
    }

    points[race] = Object.entries(racePoints)
      .sort(([, a], [, b]) => b.normalisedPoints - a.normalisedPoints)
      .reduce((r, [k, v]) => ({ ...r, [k]: v }), {})
  })

  return points
}

autoGeneratedSeasons.forEach((season) => {
  const standings = JSON.stringify(calculateStandings(season as SeasonName))
  const standingsPath = `src/data/standings/${season}.json`

  try {
    fs.writeFileSync(standingsPath, standings, { flag: 'w' })
    console.log(`${season} standings data saved to file successfully.`)
  } catch (error) {
    console.error('Error writing JSON data to file:', error)
  }

  const constructors = JSON.stringify(calculateConstructors(season as SeasonName))
  const constructorsPath = `src/data/constructors/${season}.json`

  try {
    fs.writeFileSync(constructorsPath, constructors, { flag: 'w' })
    console.log(`${season} constructors data saved to file successfully.`)
  } catch (error) {
    console.error('Error writing JSON data to file:', error)
  }
})
